-- Canonical language list (codes align with ISO 639-1 where practical).
CREATE TABLE public.languages (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT languages_code_normalized CHECK (
    code = lower(btrim(code)) AND length(code) >= 2 AND length(code) <= 15
  )
);

COMMENT ON TABLE public.languages IS 'Languages for learning / UI selections.';
COMMENT ON COLUMN public.languages.code IS 'Stable language code (e.g. es, fr, en).';
COMMENT ON COLUMN public.languages.name IS 'Display name of the language.';
COMMENT ON COLUMN public.languages.description IS 'Optional notes or glossary text.';

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY languages_select_pub
  ON public.languages
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON public.languages TO anon;
GRANT SELECT ON public.languages TO authenticated;
