# Masked Language Model (MLM) Service

A local Python microservice using Hugging Face Transformers and PyTorch to compute token recoverability/predictability scores using a Masked Language Model (MLM).

By masking individual tokens and asking the model to predict them using bidirectional context, the service calculates a **recoverability score** (predicted probability of the original token).

## Setup

```bash
cd mlm-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Optional: Install pytest for running tests
pip install pytest
```

> [!NOTE]
> The first time you start the service or run tests, it will download the default model (`distilbert-base-uncased`) from Hugging Face (~260MB).

## Run

To run the service individually:

```bash
source venv/bin/activate
uvicorn app:app --port 8002 --reload
```

Alternatively, run it via the main workspace serve script:
```bash
./scripts/serve-py.sh
```

## Configuration

The service can be configured via environment variables:

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| `MLM_MODEL` | Hugging Face MLM model to load | `distilbert-base-uncased` |
| `MLM_WORKERS` | Number of Uvicorn worker processes (used in `serve-py.sh`) | `4` |

## API Reference

### POST `/recoverable_score`

Calculates recoverability scores for the tokens in the provided text.

#### Request Body

- `text` (string, required): The input text to process.
- `exclude_ranges` (list of `CharRange`, optional): List of character ranges (defined by `start` and `end` indices) to exclude from scoring. Excluded tokens receive a `score` of `null` and are skipped during prediction.
- `include_ranges` (list of `CharRange`, optional): If provided, **only** tokens overlapping these character ranges are scored; all other tokens immediately return a `score` of `null`. This is a significant optimization when the caller only cares about a subset of positions.

```json
{
  "text": "She drove the red car.",
  "exclude_ranges": [
    { "start": 0, "end": 3 }
  ],
  "include_ranges": [
    { "start": 14, "end": 17 }
  ]
}
```

#### Response Body

Returns a list of token dicts with their tokenized text, character offset ranges, and recoverability score.

```json
{
  "tokens": [
    {
      "text": "She",
      "start": 0,
      "end": 3,
      "score": null
    },
    {
      "text": "drove",
      "start": 4,
      "end": 9,
      "score": null
    },
    {
      "text": "the",
      "start": 10,
      "end": 13,
      "score": null
    },
    {
      "text": "red",
      "start": 14,
      "end": 17,
      "score": 0.852174
    },
    {
      "text": "car",
      "start": 18,
      "end": 21,
      "score": null
    }
  ],
  "model": "distilbert-base-uncased"
}
```

## Key Features & Optimizations

- **True MLM Scoring**: Each token is individually masked, and its probability is predicted bidirectionally by the model.
- **Batching**: Masks are batched (default batch size of 32) using PyTorch tensor operations for high throughput.
- **LRU Cache**: Scores are cached (up to 64 unique text/include pairs) to bypass redundant computation.
- **Sentence Chunking**: Long text inputs are split into smaller sentence chunks using [chunker.py](file:///home/sam/Projects/gloss+1/gloss-plus-one/mlm-service/chunker.py) to prevent token sequences from exceeding the model's 512-token limit, while preserving absolute character boundaries.

## Tests

To run the unit test suite:

```bash
pytest tests/ -v
```
