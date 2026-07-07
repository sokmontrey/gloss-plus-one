from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel

from model_loader import MODEL_NAME, get_model, get_tokenizer
from scorer import score_text


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print(f"[mlm] loading {MODEL_NAME}...")
    get_tokenizer()
    get_model()
    print(f"[mlm] model ready")
    yield


app = FastAPI(lifespan=lifespan)


class ScoreRequest(BaseModel):
    text: str


class TokenScore(BaseModel):
    text: str
    start: int
    end: int
    score: float | None


class ScoreResponse(BaseModel):
    tokens: list[TokenScore]


@app.post("/recoverable_score", response_model=ScoreResponse)
async def recoverable_score(req: ScoreRequest):
    return ScoreResponse(tokens=[TokenScore(**t) for t in score_text(req.text)])