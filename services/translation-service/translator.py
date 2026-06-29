import re
from model_loader import get_model, get_aligner


def translate_sentence(sentence: str, target_lang: str) -> str:
    src_lang, tgt_lang = "en", target_lang
    lang_pair = f"{src_lang}-{tgt_lang}"
    model, tokenizer = get_model(lang_pair)
    inputs = tokenizer([sentence], return_tensors="pt", padding=True)
    translated = model.generate(**inputs)
    return tokenizer.decode(translated[0], skip_special_tokens=True)


def translate_text(text: str, target_lang: str) -> str:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    translated_parts = []
    for sent in sentences:
        sent = sent.strip()
        if sent:
            translated_parts.append(translate_sentence(sent, target_lang))
    return " ".join(translated_parts)


def align_sentences(src_sentence: str, tgt_sentence: str) -> dict[int, list[int]]:
    aligner = get_aligner()
    src_words = src_sentence.split()
    tgt_words = tgt_sentence.split()
    alignments = aligner.get_word_aligns(src_words, tgt_words)
    # Use "itermax" method result (matching_methods="i" => key "itermax")
    pairs = alignments.get("itermax", [])
    result: dict[int, list[int]] = {}
    for src_idx, tgt_idx in pairs:
        result.setdefault(src_idx, []).append(tgt_idx)
    return result


def char_offsets_to_word_indices(text: str, start: int, end: int) -> list[int]:
    word_indices = []
    pos = 0
    for i, word in enumerate(text.split()):
        word_start = text.index(word, pos)
        word_end = word_start + len(word)
        if word_start < end and word_end > start:
            word_indices.append(i)
        pos = word_end
    return word_indices


def map_lexicons(
    src_text: str,
    tgt_text: str,
    lexicons: list[dict],
    alignments: dict[int, list[int]],
) -> list[dict]:
    tgt_words = tgt_text.split()
    results = []
    for lex in lexicons:
        src_word_indices = char_offsets_to_word_indices(src_text, lex["start"], lex["end"])
        tgt_word_indices: list[int] = []
        for si in src_word_indices:
            tgt_word_indices.extend(alignments.get(si, []))
        tgt_word_indices = sorted(set(tgt_word_indices))
        if tgt_word_indices:
            target_words = [tgt_words[i].rstrip(".,;!?") for i in tgt_word_indices if i < len(tgt_words)]
            target_words = [w for w in target_words if w]
            target = " ".join(target_words) if target_words else None
        else:
            target = None
        results.append({"id": lex["id"], "source": lex["text"], "target": target})
    return results
