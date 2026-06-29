# Lexicon Splitter Service

Splits text into meaningful lexical units (noun chunks, named entities, individual words) using spaCy.

## Setup

```bash
cd lexicon-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

## Run

```bash
uvicorn app:app --reload --port 8001
```

## Test

```bash
pytest tests/ -v
```

## Usage

```bash
curl -X POST http://localhost:8001/split \
  -H "Content-Type: application/json" \
  -d '{"text": "Machine learning will revolutionize education."}'
```
