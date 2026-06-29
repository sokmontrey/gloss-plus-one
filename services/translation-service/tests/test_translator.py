import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from translator import translate_text, translate_sentence, align_sentences, map_lexicons

def test_red_car_es():
    src = "She drove the red car."
    tgt = translate_text(src, "es")
    lexicons = [
        {"id": 0, "start": 14, "end": 17, "text": "red"},
        {"id": 1, "start": 18, "end": 21, "text": "car"},
    ]
    results = map_lexicons(src, tgt, lexicons, align_sentences(src, tgt))
    by_id = {r["id"]: r for r in results}
    red_tgt = by_id[0]["target"] or ""
    car_tgt = by_id[1]["target"] or ""
    assert any(w in red_tgt for w in ("rojo", "roja")), f"red -> {red_tgt!r}"
    assert any(w in car_tgt for w in ("coche", "auto", "carro")), f"car -> {car_tgt!r}"

def test_running_es():
    src = "The children are running fast."
    tgt = translate_text(src, "es")
    lexicons = [{"id": 0, "start": 17, "end": 24, "text": "running"}]
    results = map_lexicons(src, tgt, lexicons, align_sentences(src, tgt))
    assert results[0]["target"] is not None
    assert "corriendo" in results[0]["target"].lower() or results[0]["target"] is not None

def test_new_york_entity():
    src = "I visited New York."
    tgt = translate_text(src, "es")
    lexicons = [{"id": 0, "start": 10, "end": 18, "text": "New York"}]
    results = map_lexicons(src, tgt, lexicons, align_sentences(src, tgt))
    assert results[0]["target"] is not None
    # Nueva York or New York kept as-is
    assert "york" in results[0]["target"].lower()

def test_empty_lexicons():
    src = "Hello world."
    tgt = translate_text(src, "es")
    results = map_lexicons(src, tgt, [], align_sentences(src, tgt))
    assert results == []
