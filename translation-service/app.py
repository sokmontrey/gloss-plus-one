import asyncio
from fastapi import FastAPI
from pydantic import BaseModel
from translator import translate_text, align_sentences, map_lexicons

app = FastAPI()

# MarianMT is not thread-safe — serialize inference requests
_inference_lock = asyncio.Lock()


class LexiconItem(BaseModel):
    id: int
    start: int
    end: int
    text: str


class TranslateRequest(BaseModel):
    text: str
    lexicons: list[LexiconItem]
    target_lang: str


class TranslationItem(BaseModel):
    id: int
    source: str
    target: str | None


class TranslateResponse(BaseModel):
    translations: list[TranslationItem]
    full_translation: str


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    async with _inference_lock:
        full_translation = translate_text(req.text, req.target_lang)
        alignments = align_sentences(req.text, full_translation)
        lexicons_dicts = [lex.model_dump() for lex in req.lexicons]
        mapped = map_lexicons(req.text, full_translation, lexicons_dicts, alignments)
    translations = [TranslationItem(**item) for item in mapped]
    return TranslateResponse(translations=translations, full_translation=full_translation)
