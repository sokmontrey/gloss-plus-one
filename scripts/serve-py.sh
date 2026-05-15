#!/usr/bin/env bash
set -e
trap 'kill 0' EXIT

(cd lexicon-service && source venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 8001) &
(cd mlm-service && source venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 8002) &
(cd translation-service && source venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 8003) &

wait
