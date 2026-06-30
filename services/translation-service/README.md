# Translation Service

A local Python translation microservice using Helsinki-NLP OPUS-MT models.

## Setup

```bash
cd translation-service
uv sync
```

**Note:** First run downloads models automatically (~300MB per language pair from Helsinki-NLP/OPUS-MT).

## Run

```bash
uv run uvicorn app:app --host 0.0.0.0 --port 8003
```

## API

### POST /translate

```json
{
  "text": "She drove the red car.",
  "source_lang": "en",
  "target_lang": "es"
}
```

Response:

```json
{ "translation": "Condujo el coche rojo." }
```

Supported language pairs: en-es, en-fr, en-de.
