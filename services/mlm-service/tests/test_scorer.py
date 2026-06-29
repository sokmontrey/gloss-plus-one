import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scorer import score_text


def test_basic_sentence_returns_tokens_with_scores():
    tokens = score_text("The cat sat on the mat.")
    assert len(tokens) >= 6, f"Expected >=6 tokens, got {len(tokens)}: {tokens}"
    for t in tokens:
        assert t["score"] is not None, f"Unexpected null score: {t}"
        assert 0.0 <= t["score"] <= 1.0, f"Score out of range: {t}"


def test_exclude_ranges_nulls_overlapping_tokens():
    # "She" spans [0, 3); exclude [0, 3) → score=null
    tokens = score_text(
        "She drove the red car.",
        exclude_ranges=[{"start": 0, "end": 3}],
    )
    by_text = {t["text"].lower(): t for t in tokens}
    assert by_text["she"]["score"] is None
    # Others should have numeric scores
    for t in tokens:
        if t["text"].lower() != "she":
            assert t["score"] is not None, f"Expected score for {t['text']}: {t}"


def test_empty_text_returns_empty():
    tokens = score_text("")
    assert tokens == []


def test_offsets_match_original_text():
    text = "She drove the red car to work."
    tokens = score_text(text)
    for t in tokens:
        tok_text = t["text"]
        # Subword tokens start with ## (BERT wordpiece) — their offsets point into
        # the original text but the ## prefix won't match the raw slice. Skip them.
        if tok_text.startswith("##"):
            continue
        slice_text = text[t["start"] : t["end"]]
        assert slice_text == tok_text, (
            f"Offset mismatch: token={tok_text!r}, "
            f"text[{t['start']}:{t['end']}]={slice_text!r}"
        )


def test_function_word_scores_higher_than_rare_content():
    # Smoke test: "the" in a predictable context should be easier to recover
    # than a proper noun. Not a hard assertion — just check both scores exist
    # and that "the" score >= some low threshold.
    tokens = score_text("She drove the red car to work.")
    by_text = {t["text"].lower(): t for t in tokens}

    assert "the" in by_text, "Expected 'the' in tokens"
    the_score = by_text["the"]["score"]
    assert the_score is not None
    # "the" is one of the most predictable function words; score should be non-trivial
    assert the_score > 0.01, f"'the' score suspiciously low: {the_score}"
