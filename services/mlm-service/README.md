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

```json
{
  "text": "She drove the red car."
}
```

#### Response Body

Returns a list of tokens with their text, character offset range, and recoverability score.

```json
{
  "tokens": [
    {
      "text": "She",
      "start": 0,
      "end": 3,
      "score": 0.852174
    },
    {
      "text": "drove",
      "start": 4,
      "end": 9,
      "score": 0.423891
    }
  ]
}
```

## Key Features & Optimizations

- **True MLM Scoring**: Each token is individually masked, and its probability is predicted bidirectionally by the model.
- **Batching**: Masks are batched (default batch size of 32) using PyTorch tensor operations for high throughput.
- **Sentence Chunking**: Long text inputs are split into smaller sentence chunks using [chunker.py](file:///home/sam/Projects/gloss+1/gloss-plus-one/mlm-service/chunker.py) to prevent token sequences from exceeding the model's 512-token limit, while preserving absolute character boundaries.

## Tests

To run the unit test suite:

```bash
pytest tests/ -v
```
