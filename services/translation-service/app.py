import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from translator import translate_text, LANG_MAP
from model_loader import get_model


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print("[translation] loading model...")
    get_model()
    print("[translation] ready")
    yield


app = FastAPI(lifespan=lifespan)

# MarianMT is not thread-safe — serialize inference requests
_inference_lock = asyncio.Lock()

SOURCE_LANG = "en"
SUPPORTED_PAIRS = [{"source": SOURCE_LANG, "target": tgt} for tgt in LANG_MAP]


class TranslateRequest(BaseModel):
    text: list[str]
    source_lang: str
    target_lang: str


class TranslateResponse(BaseModel):
    translations: list[str]


# ponytail: trivial one-call endpoint, integration test lives in pipeline once rewritten
@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    if req.source_lang != SOURCE_LANG or req.target_lang not in LANG_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported pair ({req.source_lang}→{req.target_lang}). "
            f"Supported: {SUPPORTED_PAIRS}",
        )
    async with _inference_lock:
        translations = translate_text(req.text, req.source_lang, req.target_lang)
    return TranslateResponse(translations=translations)


@app.get("/languages")
def languages():
    return {"supported_pairs": SUPPORTED_PAIRS}
