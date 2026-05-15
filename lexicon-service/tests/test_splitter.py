import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from splitter import split


def test_machine_learning_sentence():
    result = split("Machine learning will revolutionize education.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    # "Machine learning" is a compound noun — kept as a unit
    assert "Machine learning" in texts
    assert types["Machine learning"] == "compound"
    assert "Machine" not in texts
    assert "learning" not in texts
    assert "revolutionize" in texts
    assert types["revolutionize"] == "content"
    assert "education" in texts
    assert "will" in texts
    assert types["will"] == "function"
    assert "." not in texts


def test_function_words_included():
    result = split("The cat sat on the mat.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    assert "The" in texts
    assert types["The"] == "function"
    assert "on" in texts
    assert types["on"] == "function"
    assert "sat" in texts
    assert types["sat"] == "content"


def test_new_york_entity():
    result = split("I visited New York last summer.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    assert "New York" in texts
    assert types["New York"] == "entity"
    assert "New" not in texts
    assert "York" not in texts
    assert "I" in texts
    assert types["I"] == "function"


def test_no_noun_chunks():
    result = split("The big red ball bounced.")
    texts = [l["text"] for l in result]

    # spaCy (en_core_web_sm) parses "red" as compound of "ball" → grouped
    # "big" is amod → kept separate
    # The full noun chunk "The big red ball" is NOT kept as one unit
    assert "The big red ball" not in texts
    assert "The" in texts
    assert "big" in texts
    # "red ball" is a compound per spaCy's dep parse
    assert "red ball" in texts or ("red" in texts and "ball" in texts)


def test_empty_string():
    result = split("")
    assert result == []


def test_offsets_match():
    text = "Machine learning will revolutionize education."
    result = split(text)
    for lex in result:
        assert text[lex["start"]:lex["end"]] == lex["text"]


def test_phrasal_verb_give_up():
    result = split("I need to give up smoking.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    assert "give up" in texts
    assert types["give up"] == "phrase"
    assert "give" not in texts
    assert "up" not in texts
    assert "smoking" in texts
    assert types["smoking"] == "content"


def test_phrasal_verb_look_up():
    result = split("Can you look up this word?")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    assert "look up" in texts
    assert types["look up"] == "phrase"
    assert "look" not in texts
    assert "word" in texts
    assert types["word"] == "content"


def test_phrasal_verb_inflected_gave_up():
    result = split("He gave up his seat on the train.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    # LEMMA matching: "gave up" should match "give up" pattern
    assert "gave up" in texts
    assert types["gave up"] == "phrase"
    assert "gave" not in texts


def test_phrasal_verb_look_forward_to():
    result = split("I'm looking forward to the trip.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    assert "looking forward to" in texts
    assert types["looking forward to"] == "phrase"
    assert "looking" not in texts
    assert "trip" in texts
    # "I'm" should be merged (I + 'm)
    assert "I'm" in texts
    assert "'m" not in texts


def test_compound_noun_coffee_shop():
    # Use a sentence where spaCy cleanly parses "coffee" as compound of "shop"
    # (adding "downtown" as a separate head confuses en_core_web_sm's parse)
    result = split("She works at the coffee shop.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    assert "coffee shop" in texts
    assert types["coffee shop"] == "compound"
    assert "coffee" not in texts
    assert "shop" not in texts
    assert "works" in texts
    assert types["works"] == "content"


def test_entity_plus_compound_non_overlapping():
    # "New York" is entity; "train station" is compound — both kept
    result = split("I visited the New York train station.")
    texts = [l["text"] for l in result]
    types = {l["text"]: l["type"] for l in result}

    assert "New York" in texts
    assert types["New York"] == "entity"
    assert "train station" in texts
    assert types["train station"] == "compound"
    assert "New" not in texts
    assert "York" not in texts
    assert "train" not in texts
    assert "station" not in texts


def test_contraction_ill():
    result = split("I'll be there.")
    texts = [l["text"] for l in result]

    assert "I'll" in texts
    assert "'ll" not in texts
    assert "I" not in texts


def test_contraction_dont():
    result = split("I don't know why.")
    texts = [l["text"] for l in result]

    assert "don't" in texts
    assert "n't" not in texts
    assert "do" not in texts


def test_contraction_shes():
    result = split("She's been running.")
    texts = [l["text"] for l in result]

    assert "She's" in texts
    assert "'s" not in texts
    assert "She" not in texts


def test_contraction_weve():
    result = split("We've arrived early.")
    texts = [l["text"] for l in result]

    assert "We've" in texts
    assert "'ve" not in texts
    assert "We" not in texts


def test_contraction_offsets():
    text = "I'll be there and I don't know why."
    result = split(text)
    for lex in result:
        assert text[lex["start"]:lex["end"]] == lex["text"], (
            f"Offset mismatch for {lex['text']!r}: "
            f"text[{lex['start']}:{lex['end']}] = {text[lex['start']:lex['end']]!r}"
        )


def test_emoji_offsets():
    text = "I love 🍕 pizza today."
    result = split(text)
    for lex in result:
        assert text[lex["start"]:lex["end"]] == lex["text"], (
            f"Offset mismatch for {lex['text']!r}: "
            f"text[{lex['start']}:{lex['end']}] = {text[lex['start']:lex['end']]!r}"
        )
