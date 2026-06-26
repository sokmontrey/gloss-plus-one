help: ##@Miscellaneous Show this help message
	@uv run ./scripts/help.py
.PHONY: help

setup: ##@Development Install dependentcies for the project
	npm i && cd lexicon-service && uv sync && cd ../mlm-service && uv sync && cd ../translation-service && uv sync
.PHONY:setup

clean: ##@Development Delete temporary files from the project
	find . -type d -name '.venv' | xargs rm -rf; find . -type d -name '__pycache__' | xargs rm -rf
.PHONY:clean