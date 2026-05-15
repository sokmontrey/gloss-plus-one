# Translation Service

A local Python translation microservice using Helsinki-NLP OPUS-MT models and SimAlign for word-level alignment.

## Setup

```bash
cd translation-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Note:** First run downloads models automatically:
- ~300MB per language pair (en-es, en-fr, en-de) from Helsinki-NLP/OPUS-MT
- ~700MB for the SimAlign BERT alignment model

## Run

```bash
uvicorn app:app --port 8003
```

## API

### POST /translate

```json
{
  "text": "She drove the red car.",
  "target_lang": "es",
  "lexicons": [
    { "id": 0, "start": 14, "end": 17, "text": "red" },
    { "id": 1, "start": 18, "end": 21, "text": "car" }
  ]
}
```

Response:

```json
{
  "full_translation": "Condujo el coche rojo.",
  "translations": [
    { "id": 0, "source": "red", "target": "rojo" },
    { "id": 1, "source": "car", "target": "coche" }
  ]
}
```

Supported target languages: `es`, `fr`, `de`

## Tests

```bash
pytest tests/ -v
```
