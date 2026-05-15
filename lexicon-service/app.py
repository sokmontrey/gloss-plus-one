from fastapi import FastAPI
from pydantic import BaseModel

from splitter import split

app = FastAPI(title="Lexicon Splitter")


class SplitRequest(BaseModel):
    text: str


class Lexicon(BaseModel):
    id: int
    start: int
    end: int
    text: str
    type: str


class SplitResponse(BaseModel):
    lexicons: list[Lexicon]


@app.post("/split", response_model=SplitResponse)
def split_endpoint(req: SplitRequest) -> SplitResponse:
    lexicons = split(req.text)
    return SplitResponse(lexicons=lexicons)
