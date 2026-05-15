import threading
import torch
from transformers import AutoTokenizer, AutoModelForMaskedLM

MODEL_NAME = "distilbert-base-uncased"

_tokenizer = None
_model = None
_lock = threading.Lock()


def get_tokenizer():
    _ensure_loaded()
    return _tokenizer


def get_model():
    _ensure_loaded()
    return _model


def get_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _ensure_loaded():
    global _tokenizer, _model
    if _tokenizer is not None:
        return
    with _lock:
        if _tokenizer is not None:
            return
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=True)
        model = AutoModelForMaskedLM.from_pretrained(MODEL_NAME)
        model.eval()
        model.to(get_device())
        _tokenizer = tokenizer
        _model = model
