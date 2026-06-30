import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
from translator import translate_text
from model_loader import get_model, SUPPORTED_PAIRS


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print("[translation] loading models...")
    for pair in SUPPORTED_PAIRS:
        print(f"[translation] loading {pair}...")
        get_model(pair)
    print("[translation] ready")
    yield


app = FastAPI(lifespan=lifespan)

# MarianMT is not thread-safe — serialize inference requests
_inference_lock = asyncio.Lock()


class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str


class TranslateResponse(BaseModel):
    translation: str


# ponytail: trivial one-call endpoint, integration test lives in pipeline once rewritten
@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    async with _inference_lock:
        translation = translate_text(req.text, req.source_lang, req.target_lang)
    return TranslateResponse(translation=translation)
