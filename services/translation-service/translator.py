from model_loader import get_model


def translate_sentence(text: str, src_lang: str, tgt_lang: str) -> str:
    model, tokenizer = get_model(f"{src_lang}-{tgt_lang}")
    inputs = tokenizer([text], return_tensors="pt", padding=True)
    translated = model.generate(**inputs)
    return tokenizer.decode(translated[0], skip_special_tokens=True)


# ponytail: single batch, split sentences if inputs exceed model max_length
def translate_text(text: str, src_lang: str, tgt_lang: str) -> str:
    return translate_sentence(text.strip(), src_lang, tgt_lang)
