import spacy
from spacy.matcher import PhraseMatcher
from phrases import PHRASAL_VERBS, IDIOMS

nlp = spacy.load("en_core_web_sm")

# POS tags for content words
CONTENT_POS = {"NOUN", "VERB", "ADJ", "ADV", "PROPN"}

# POS tags for function words (structure/grammar)
FUNCTION_POS = {"DET", "ADP", "AUX", "CCONJ", "SCONJ", "PART", "PRON"}

# PhraseMatcher using LEMMA so inflected forms match ("gave up" → "give up")
_phrase_matcher = PhraseMatcher(nlp.vocab, attr="LEMMA")
_phrase_patterns = [nlp(p) for p in PHRASAL_VERBS + IDIOMS]
_phrase_matcher.add("PHRASES", _phrase_patterns)

# Type priority for overlap resolution (lower = higher priority)
_TYPE_PRIORITY = {"entity": 0, "phrase": 1, "compound": 2}


def split(text: str) -> list[dict]:
    if not text.strip():
        return []

    doc = nlp(text)

    # Step 1: Collect multi-word candidates: entities, phrases, compounds
    candidates: list[tuple[int, int, str, str]] = []

    # Named entities (multi-word only) — collected first so compounds can avoid them
    entity_occupied: list[tuple[int, int]] = []
    for ent in doc.ents:
        if len(ent) > 1:
            candidates.append((ent.start_char, ent.end_char, ent.text, "entity"))
            entity_occupied.append((ent.start_char, ent.end_char))

    # Phrasal verbs / idioms via PhraseMatcher (LEMMA-based)
    for _, start_tok, end_tok in _phrase_matcher(doc):
        span = doc[start_tok:end_tok]
        if len(span) > 1:
            candidates.append((span.start_char, span.end_char, span.text, "phrase"))

    # Compound nouns via dep_ relation
    # Direct compound children of a non-compound head, excluding entity-occupied tokens
    # (prevents "York" from extending a compound past a named entity boundary)
    for token in doc:
        if token.dep_ == "compound" and not token.is_punct:
            head = token.head
            if head.dep_ != "compound":
                compound_tokens = [
                    t for t in head.children
                    if t.dep_ == "compound"
                    and not t.is_punct
                    and not t.is_space
                    and not _overlaps(t.idx, t.idx + len(t.text), entity_occupied)
                ]
                if not _overlaps(head.idx, head.idx + len(head.text), entity_occupied):
                    compound_tokens.append(head)
                if len(compound_tokens) > 1:
                    compound_tokens_sorted = sorted(compound_tokens, key=lambda t: t.i)
                    c_start = compound_tokens_sorted[0].idx
                    c_end = compound_tokens_sorted[-1].idx + len(compound_tokens_sorted[-1].text)
                    c_text = doc.text[c_start:c_end]
                    candidates.append((c_start, c_end, c_text, "compound"))

    # Step 2: Resolve overlaps — longer span wins; ties broken by type priority
    candidates.sort(key=lambda c: (-(c[1] - c[0]), _TYPE_PRIORITY.get(c[3], 3)))

    kept: list[tuple[int, int, str, str]] = []
    occupied: list[tuple[int, int]] = []

    for start, end, text_span, span_type in candidates:
        if _overlaps(start, end, occupied):
            continue
        kept.append((start, end, text_span, span_type))
        occupied.append((start, end))

    # Step 3: Add individual tokens not inside kept spans
    # Merge contractions ('ll, n't, 've, 's, 'd, 're, 'm) into preceding token.
    # Detect by: no whitespace gap between preceding token's end and this token's start.
    tokens = [t for t in doc if not t.is_punct and not t.is_space]
    skip_indices: set[int] = set()

    for i, token in enumerate(tokens):
        if i == 0:
            continue
        prev = tokens[i - 1]
        prev_end = prev.idx + len(prev.text)
        if token.idx == prev_end:
            # Adjacent tokens with no whitespace — contraction part (n't, 'll, 's, etc.)
            skip_indices.add(i)

    i = 0
    while i < len(tokens):
        token = tokens[i]

        if i in skip_indices:
            i += 1
            continue

        t_start = token.idx
        t_end = token.idx + len(token.text)

        # Absorb following contraction tokens
        j = i + 1
        while j < len(tokens) and j in skip_indices:
            t_end = tokens[j].idx + len(tokens[j].text)
            j += 1

        t_text = text[t_start:t_end]

        if _overlaps(t_start, t_end, occupied):
            i = j
            continue

        if token.pos_ in FUNCTION_POS:
            kept.append((t_start, t_end, t_text, "function"))
        elif token.pos_ in CONTENT_POS:
            kept.append((t_start, t_end, t_text, "content"))
        else:
            kept.append((t_start, t_end, t_text, "content"))

        occupied.append((t_start, t_end))
        i = j

    # Step 4: Sort by start offset, assign sequential ids
    kept.sort(key=lambda c: c[0])

    return [
        {"id": i, "start": start, "end": end, "text": txt, "type": span_type}
        for i, (start, end, txt, span_type) in enumerate(kept)
    ]


def _overlaps(start: int, end: int, occupied: list[tuple[int, int]]) -> bool:
    for occ_start, occ_end in occupied:
        if start < occ_end and end > occ_start:
            return True
    return False
