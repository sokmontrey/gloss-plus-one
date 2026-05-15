"""
Pure scoring logic — no FastAPI imports.

score_text(text, exclude_ranges) -> list of token dicts with keys:
    text, start, end, score (float | None)

Uses true masked-LM scoring: each token is masked individually, and the model
predicts it from bidirectional context. The predicted probability of the original
token is the recoverability score.

Optimization: batches masked variants (batch_size=32) for throughput.
"""

import re
import torch
import torch.nn.functional as F
from model_loader import get_tokenizer, get_model, get_device, MODEL_NAME
from chunker import chunk_text

BATCH_SIZE = 32

# Regex that matches strings containing only punctuation / whitespace
_PUNCT_RE = re.compile(r"^[\W_]+$")


def score_text(
    text: str,
    exclude_ranges: list[dict] | None = None,
) -> list[dict]:
    """
    Tokenize `text`, score each token by masked-LM confidence, return token list.

    exclude_ranges: list of {"start": int, "end": int} in original text coordinates.
    Tokens overlapping any excluded range get score=null and are skipped by the model.
    """
    if not text.strip():
        return []

    exclude = exclude_ranges or []

    # Process in sentence chunks to stay within the 512-token limit
    results: list[dict] = []
    for chunk, chunk_offset in chunk_text(text):
        chunk_results = _score_chunk(chunk, chunk_offset, exclude)
        results.extend(chunk_results)

    # Sort by start offset (chunks are already ordered, but be safe)
    results.sort(key=lambda t: t["start"])
    return results


def _score_chunk(
    chunk: str,
    chunk_offset: int,
    exclude_ranges: list[dict],
) -> list[dict]:
    tokenizer = get_tokenizer()
    model = get_model()
    device = get_device()

    encoding = tokenizer(
        chunk,
        return_tensors="pt",
        return_offsets_mapping=True,
        truncation=True,
        max_length=512,
    )

    input_ids = encoding["input_ids"][0]           # (seq_len,)
    attention_mask = encoding["attention_mask"][0]  # (seq_len,)
    offset_mapping = encoding["offset_mapping"][0]  # (seq_len, 2)

    mask_token_id = tokenizer.mask_token_id

    # Build per-token records
    records: list[dict] = []
    scorable_positions: list[int] = []  # indices into records that we will mask

    for i, (tok_id, (tok_start_rel, tok_end_rel)) in enumerate(
        zip(input_ids.tolist(), offset_mapping.tolist())
    ):
        # Skip special tokens ([CLS], [SEP], [PAD])
        if tok_start_rel == 0 and tok_end_rel == 0:
            continue

        tok_start_abs = chunk_offset + tok_start_rel
        tok_end_abs = chunk_offset + tok_end_rel
        tok_text = chunk[tok_start_rel:tok_end_rel]

        # Skip pure punctuation tokens
        if _PUNCT_RE.match(tok_text):
            continue

        # Check exclusion
        excluded = _overlaps(tok_start_abs, tok_end_abs, exclude_ranges)

        records.append({
            "text": tok_text,
            "start": tok_start_abs,
            "end": tok_end_abs,
            "score": None,
            "_pos": i,          # position in input_ids — removed before returning
            "_tok_id": tok_id,  # original token id — removed before returning
            "_excluded": excluded,
        })

        if not excluded:
            scorable_positions.append(len(records) - 1)  # index into records list

    if not scorable_positions:
        return _clean(records)

    # Batch masked forward passes — true bidirectional MLM scoring
    base_ids = input_ids.unsqueeze(0)  # (1, seq_len)
    base_mask = attention_mask.unsqueeze(0)

    scores = _batch_score(
        model, device, base_ids, base_mask, mask_token_id,
        [records[ri]["_pos"] for ri in scorable_positions],
        [records[ri]["_tok_id"] for ri in scorable_positions],
    )

    for ri, score in zip(scorable_positions, scores):
        records[ri]["score"] = score

    return _clean(records)


def _batch_score(
    model,
    device: torch.device,
    base_ids: torch.Tensor,
    base_mask: torch.Tensor,
    mask_token_id: int,
    positions: list[int],
    original_token_ids: list[int],
) -> list[float]:
    """
    For each position, mask that single token and run a forward pass.
    The model sees all OTHER tokens (bidirectional context) but not the target.
    Returns the predicted probability of the original token at its masked position.
    """
    scores: list[float] = []

    for batch_start in range(0, len(positions), BATCH_SIZE):
        batch_positions = positions[batch_start : batch_start + BATCH_SIZE]
        batch_orig_ids = original_token_ids[batch_start : batch_start + BATCH_SIZE]
        batch_size = len(batch_positions)

        # Build masked variants: (batch_size, seq_len)
        batch_ids = base_ids.repeat(batch_size, 1).clone()
        batch_mask_tensor = base_mask.repeat(batch_size, 1)

        for k, pos in enumerate(batch_positions):
            batch_ids[k, pos] = mask_token_id

        batch_ids = batch_ids.to(device)
        batch_mask_tensor = batch_mask_tensor.to(device)

        with torch.no_grad():
            logits = model(
                input_ids=batch_ids,
                attention_mask=batch_mask_tensor,
            ).logits  # (batch_size, seq_len, vocab_size)

        probs = F.softmax(logits, dim=-1)  # (batch_size, seq_len, vocab_size)

        for k, (pos, orig_id) in enumerate(zip(batch_positions, batch_orig_ids)):
            p = probs[k, pos, orig_id].item()
            scores.append(round(p, 6))

    return scores


def _overlaps(start: int, end: int, ranges: list[dict]) -> bool:
    for r in ranges:
        if start < r["end"] and end > r["start"]:
            return True
    return False


def _clean(records: list[dict]) -> list[dict]:
    """Remove internal bookkeeping keys before returning."""
    return [
        {k: v for k, v in rec.items() if not k.startswith("_")}
        for rec in records
    ]
