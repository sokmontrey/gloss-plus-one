from model_loader import get_model

# 2-letter ISO → 3-letter OPUS code (model vocab uses 3-letter).
# ponytail: only "pt" mapped; add es/fr/it/ro when callers need them.
LANG_MAP = {"pt": "por"}


# ponytail: single batch, split sentences if inputs exceed model max_length
def translate_text(texts: list[str], src_lang: str, tgt_lang: str) -> list[str]:
    code = LANG_MAP.get(tgt_lang, tgt_lang)
    model, tokenizer = get_model()
    inputs = tokenizer(
        [f">>{code}<< {t.strip()}" for t in texts],
        return_tensors="pt",
        padding=True,
    )
    translated = model.generate(**inputs)
    return [tokenizer.decode(t, skip_special_tokens=True) for t in translated]
