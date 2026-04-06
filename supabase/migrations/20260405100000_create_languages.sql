CREATE TABLE public.languages (
  id   char(2) PRIMARY KEY,   -- ISO 639-1 code ('en', 'ko', 'ja', ...)
  name text    NOT NULL
);
