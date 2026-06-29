help: ##@Miscellaneous Show this help message
	@uv run ./scripts/help.py
.PHONY: help

setup: ##@Development Install dependentcies for the project
	@npm i &&\
	cd lexicon-service && uv sync &&\
	cd ../mlm-service && uv sync &&\
	cd ../translation-service && uv sync
.PHONY:setup

build-extension: ##@Development Build gloss-plus-one web extension
	@npm run build
.PHONY:build-extension

start-functions: ##@Development Start edge functions
	@supabase functions serve --env-file .env
.PHONY:start-functions

start-services: ##@Development Start services
	@docker compose up
.PHONY:start-service

clean: ##@Development Delete dependency files from the project
	@find . -type d -name '.venv' | xargs rm -rf &&\
	find . -type d -name '__pycache__' | xargs rm -rf &&\
	rm -rf node_modules
.PHONY:clean

start-db: ##@Database Start database
	@supabase start
.PHONY:start-db

stop-db: ##@Database Stop database
	@supabase stop
.PHONY:stop-db