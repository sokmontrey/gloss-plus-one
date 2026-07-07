from transformers import MarianMTModel, MarianTokenizer

_model: tuple | None = None


# Helsinki-NLP/opus-mt-en-roa: multilingual en→Romance (~300MB), covers pt.
# Dedicated en-pt doesn't exist; this model + forced_bos_token_id picks the target.
# ponytail: no int8/4bit quant — add bitsandbytes only if peak RAM is a problem.
def get_model() -> tuple[MarianMTModel, MarianTokenizer]:
    global _model
    if _model is None:
        model_name = "Helsinki-NLP/opus-mt-en-roa"
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name, low_cpu_mem_usage=True)
        model.eval()
        _model = (model, tokenizer)
    return _model
