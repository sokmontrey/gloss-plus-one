# Translation Service

A local Python translation microservice using Helsinki-NLP OPUS-MT models.

## Setup

```bash
cd translation-service
uv sync
```

**Note:** First run downloads the model automatically (~300MB from Helsinki-NLP/OPUS-MT).

## Run

```bash
uv run uvicorn app:app --host 0.0.0.0 --port 8003
```

## API

### GET /languages

```json
{ "supported_pairs": [{ "source": "en", "target": "pt" }] }
```

### POST /translate

```json
{
  "text": ["She drove the red car.", "Good morning."],
  "source_lang": "en",
  "target_lang": "pt"
}
```

Response:

```json
{ "translations": ["Ela conduziu o carro vermelho.", "Bom dia."] }
```

Backed by `Helsinki-NLP/opus-mt-en-roa` (multilingual en→Romance, ~300MB). The API currently exposes only `en→pt`; the underlying model supports more Romance targets but they're not mapped in `LANG_MAP` yet.
