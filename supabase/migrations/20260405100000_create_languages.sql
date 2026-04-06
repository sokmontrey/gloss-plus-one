CREATE TABLE public.languages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,   -- ISO 639-1: 'en', 'ko', 'fr'
  name       text NOT NULL,          -- 'English', 'Korean', 'French'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY languages_read ON public.languages
  FOR SELECT TO authenticated
  USING (true);
