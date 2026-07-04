from spacy.tokens import Doc

from model import Unit

WORD_CLASS_TABLE = {
    'ADJ': 'adjective',
    'ADP': 'adposition',
    'ADV': 'adverb',
    'AUX': 'auxiliary',
    'CCONJ': 'coordinating conjunction',
    'DET': 'determiner',
    'INTJ': 'interjection',
    'NOUN': 'noun',
    'NUM': 'numeral',
    'PART': 'particle',
    'PRON': 'pronoun',
    'PUNCT': 'punctuation',
    'SCONJ': 'subordinating conjunction',
    'SYN': 'symbol',
    'VERB': 'verb',
    'X': 'other',
}


def tokenize(text: Doc) -> list[tuple[str, str]]:
    tokens = []
    for t in text:
        tokens.append((t.text, t.pos_))
    return tokens


def generate_units(tokens: list[tuple[str, str]]) -> list[Unit]:
    units = []
    text_counter = 0
    for text, word_class in tokens:
        start = text_counter
        text_counter += len(text)
        end = text_counter
        units.append(
            Unit(
                text=text,
                start=start,
                end=end,
                word_class=WORD_CLASS_TABLE[word_class],
            )
        )

    return units
