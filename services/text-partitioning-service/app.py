from model import Response, Request
from fastapi import FastAPI
import spacy

from unit_generation import tokenize, generate_units

app = FastAPI()


@app.post('/partition', response_model=Response)
def partition_endpoint(req: Request) -> Response:
    npl_source = spacy.load('en_core_web_sm')
    source_text = npl_source(req.text)
    source_tokens = tokenize(source_text)
    units = generate_units(source_tokens)
    return Response(original=req.text, units=units)
