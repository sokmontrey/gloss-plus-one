"""
Pure scoring logic — no FastAPI imports.

score_text(text, exclude_ranges, include_ranges) -> list of token dicts with keys:
    text, start, end, score (float | None)

Uses true masked-LM scoring: each token is masked individually, and the model
predicts it from bidirectional context. The predicted probability of the original
token is the recoverability score.

Optimization: batches masked variants (batch_size=32) for throughput.
include_ranges: if provided, only tokens overlapping those ranges are scored —
the rest are returned with score=None. This is the key speedup: callers that
only care about function words pass those positions and skip scoring everything else.
"""

import hashlib
import re
from collections import OrderedDict

import torch
import torch.nn.functional as F
from model_loader import get_tokenizer, get_model, get_device
from chunker import chunk_text

BATCH_SIZE = 32
_CACHE_MAX = 64

# Regex that matches strings containing only punctuation / whitespace
_PUNCT_RE = re.compile(r"^[\W_]+$")

# LRU cache: (text_hash, include_key) -> scored token list
_score_cache: OrderedDict = OrderedDict()


def _cache_key(text: str, include_ranges: list[dict] | None) -> str:
    h = hashlib.md5(text.encode()).hexdigest()[:16]
    if not include_ranges:
        return h
    pairs = ",".join(f"{r['start']}-{r['end']}" for r in sorted(include_ranges, key=lambda r: r["start"]))
    return f"{h}:{pairs}"


def score_text(
    text: str,
    exclude_ranges: list[dict] | None = None,
    include_ranges: list[dict] | None = None,
) -> list[dict]:
    """
    Tokenize `text`, score each token by masked-LM confidence, return token list.

    exclude_ranges: tokens overlapping any excluded range get score=None and are skipped.
    include_ranges: if provided, ONLY tokens overlapping these ranges are scored;
                    all other tokens are returned with score=None. This is much faster
                    than scoring everything when callers only need a subset of positions.
    """
    if not text.strip():
        return []

    key = _cache_key(text, include_ranges)
    if key in _score_cache:
        _score_cache.move_to_end(key)
        return _score_cache[key]

    exclude = exclude_ranges or []

    results: list[dict] = []
    for chunk, chunk_offset in chunk_text(text):
        chunk_results = _score_chunk(chunk, chunk_offset, exclude, include_ranges)
        results.extend(chunk_results)

    results.sort(key=lambda t: t["start"])

    _score_cache[key] = results
    if len(_score_cache) > _CACHE_MAX:
        _score_cache.popitem(last=False)

    return results


def _score_chunk(
    chunk: str,
    chunk_offset: int,
    exclude_ranges: list[dict],
    include_ranges: list[dict] | None,
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

    records: list[dict] = []
    scorable_positions: list[int] = []

    for i, (tok_id, (tok_start_rel, tok_end_rel)) in enumerate(
        zip(input_ids.tolist(), offset_mapping.tolist())
    ):
        # Skip special tokens ([CLS], [SEP], [PAD])
        if tok_start_rel == 0 and tok_end_rel == 0:
            continue

        tok_start_abs = chunk_offset + tok_start_rel
        tok_end_abs = chunk_offset + tok_end_rel
        tok_text = chunk[tok_start_rel:tok_end_rel]

        if _PUNCT_RE.match(tok_text):
            continue

        # A token is excluded if it's in exclude_ranges, or if include_ranges is set
        # and the token doesn't overlap any included range.
        excluded = _overlaps(tok_start_abs, tok_end_abs, exclude_ranges)
        if not excluded and include_ranges is not None:
            excluded = not _overlaps(tok_start_abs, tok_end_abs, include_ranges)

        records.append({
            "text": tok_text,
            "start": tok_start_abs,
            "end": tok_end_abs,
            "score": None,
            "_pos": i,
            "_tok_id": tok_id,
            "_excluded": excluded,
        })

        if not excluded:
            scorable_positions.append(len(records) - 1)

    if not scorable_positions:
        return _clean(records)

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
            ).logits  # (batch_size, seq_len, vocab_size)

        probs = F.softmax(logits, dim=-1)

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
    return [
        {k: v for k, v in rec.items() if not k.startswith("_")}
        for rec in records
    ]
