"""
Masked-LM scoring: tokenize text, mask each token, return its predicted probability.

Token dicts: text, start, end (char offsets into original text), score (float or None).
Punctuation/whitespace tokens get score=None (no signal). Batched for throughput.
"""

import re

import torch
import torch.nn.functional as F

from chunker import chunk_text
from model_loader import get_device, get_model, get_tokenizer

BATCH_SIZE = 32

_PUNCT_RE = re.compile(r"^[\W_]+$")


def score_text(text: str) -> list[dict]:
    if not text.strip():
        return []

    results: list[dict] = []
    for chunk, chunk_offset in chunk_text(text):
        results.extend(_score_chunk(chunk, chunk_offset))

    results.sort(key=lambda t: t["start"])
    return results


def _score_chunk(chunk: str, chunk_offset: int) -> list[dict]:
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

    input_ids = encoding["input_ids"][0]
    attention_mask = encoding["attention_mask"][0]
    offset_mapping = encoding["offset_mapping"][0]
    mask_token_id = tokenizer.mask_token_id

    records: list[dict] = []
    scorable: list[tuple[int, dict, int]] = []  # (pos, record, orig_id)

    for i, (tok_id, (tok_start_rel, tok_end_rel)) in enumerate(
        zip(input_ids.tolist(), offset_mapping.tolist())
    ):
        # ponytail: skip special tokens via (0,0) offset sentinel; reliable for BERT-family
        if tok_start_rel == 0 and tok_end_rel == 0:
            continue

        tok_text = chunk[tok_start_rel:tok_end_rel]
        rec = {
            "text": tok_text,
            "start": chunk_offset + tok_start_rel,
            "end": chunk_offset + tok_end_rel,
            "score": None,
        }
        records.append(rec)

        if not _PUNCT_RE.match(tok_text):
            scorable.append((i, rec, tok_id))

    if not scorable:
        return records

    base_ids = input_ids.unsqueeze(0)
    base_mask = attention_mask.unsqueeze(0)

    scores = _batch_score(
        model,
        device,
        base_ids,
        base_mask,
        mask_token_id,
        [p for p, _, _ in scorable],
        [oid for _, _, oid in scorable],
    )

    for (_, rec, _), score in zip(scorable, scores):
        rec["score"] = score

    return records


def _batch_score(
    model,
    device: torch.device,
    base_ids: torch.Tensor,
    base_mask: torch.Tensor,
    mask_token_id: int,
    positions: list[int],
    original_token_ids: list[int],
) -> list[float]:
    scores: list[float] = []

    for batch_start in range(0, len(positions), BATCH_SIZE):
        batch_positions = positions[batch_start : batch_start + BATCH_SIZE]
        batch_orig_ids = original_token_ids[batch_start : batch_start + BATCH_SIZE]
        batch_size = len(batch_positions)

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
            ).logits

        probs = F.softmax(logits, dim=-1)

        for k, (pos, orig_id) in enumerate(zip(batch_positions, batch_orig_ids)):
            scores.append(round(probs[k, pos, orig_id].item(), 6))

    return scores