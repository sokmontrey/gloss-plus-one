from fastapi import FastAPI
from pydantic import BaseModel
from scorer import score_text
from model_loader import MODEL_NAME

app = FastAPI()


class ExcludeRange(BaseModel):
    start: int
    end: int


class ScoreRequest(BaseModel):
    text: str
    exclude_ranges: list[ExcludeRange] = []


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
    tokens = score_text(req.text, exclude)
    return ScoreResponse(
        tokens=[TokenScore(**t) for t in tokens],
        model=MODEL_NAME,
    )
