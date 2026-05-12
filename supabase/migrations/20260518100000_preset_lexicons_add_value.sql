ALTER TABLE public.preset_lexicons
  ADD COLUMN value text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.preset_lexicons.value IS 'Arbitrary lexical string (PostgreSQL text = full Unicode).';

ALTER TABLE public.preset_lexicons
  ALTER COLUMN value DROP DEFAULT;
