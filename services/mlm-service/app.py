from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
from scorer import score_text
from model_loader import MODEL_NAME, get_model, get_tokenizer


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print(f"[mlm] loading {MODEL_NAME}...")
    get_tokenizer()
    get_model()
    print(f"[mlm] model ready")
    yield


app = FastAPI(lifespan=lifespan)


class CharRange(BaseModel):
    start: int
    end: int


class ScoreRequest(BaseModel):
    text: str
    exclude_ranges: list[CharRange] = []
    include_ranges: list[CharRange] | None = None


class TokenScore(BaseModel):
    text: str
    start: int
    end: int
    score: float | None


class ScoreResponse(BaseModel):
    tokens: list[TokenScore]
    model: str


@app.post("/recoverable_score", response_model=ScoreResponse)
async def recoverable_score(req: ScoreRequest):
    exclude = [{"start": r.start, "end": r.end} for r in req.exclude_ranges]
    include = [{"start": r.start, "end": r.end} for r in req.include_ranges] if req.include_ranges is not None else None
    tokens = score_text(req.text, exclude, include)
    return ScoreResponse(
        tokens=[TokenScore(**t) for t in tokens],
        model=MODEL_NAME,
    )
