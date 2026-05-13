CREATE TABLE public.user_lexicon_confidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages (code) ON UPDATE CASCADE,
  value text NOT NULL,
  confident_score double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_lexicon_confidents_score_range CHECK (
    confident_score >= 0::double precision
    AND confident_score <= 1::double precision
  )
);

CREATE INDEX user_lexicon_confidents_user_lang_idx
  ON public.user_lexicon_confidents (user_id, language_code);

COMMENT ON TABLE public.user_lexicon_confidents IS 'Per-user confidence in recognizing/producing lexemes by language.';
COMMENT ON COLUMN public.user_lexicon_confidents.value IS 'Lexeme form (any Unicode/script).';
COMMENT ON COLUMN public.user_lexicon_confidents.confident_score IS 'Confidence 0–1 inclusive.';

ALTER TABLE public.user_lexicon_confidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_lexicon_confidents_select_own
  ON public.user_lexicon_confidents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_lexicon_confidents_insert_own
  ON public.user_lexicon_confidents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_lexicon_confidents_update_own
  ON public.user_lexicon_confidents
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_lexicon_confidents_delete_own
  ON public.user_lexicon_confidents
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lexicon_confidents TO authenticated;
