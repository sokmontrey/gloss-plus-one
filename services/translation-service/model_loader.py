from transformers import MarianMTModel, MarianTokenizer

_model_cache: dict[str, tuple] = {}
_aligner = None

SUPPORTED_PAIRS = ["en-es", "en-fr", "en-de"]


def get_model(lang_pair: str) -> tuple[MarianMTModel, MarianTokenizer]:
    if lang_pair not in _model_cache:
        model_name = f"Helsinki-NLP/opus-mt-{lang_pair}"
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)
        model.eval()
        _model_cache[lang_pair] = (model, tokenizer)
    return _model_cache[lang_pair]


def get_aligner():
    global _aligner
    if _aligner is None:
        from simalign import SentenceAligner
        _aligner = SentenceAligner(matching_methods="i")
    return _aligner
