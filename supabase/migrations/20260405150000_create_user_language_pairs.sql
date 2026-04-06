CREATE TABLE public.user_language_pairs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_language_id uuid        NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  target_language_id uuid        NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  is_active          boolean     DEFAULT true,
  created_at         timestamptz DEFAULT now(),

  UNIQUE (user_id, source_language_id, target_language_id)
);

CREATE INDEX idx_user_lang_pairs_user
  ON public.user_language_pairs (user_id);

ALTER TABLE public.user_language_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_lang_pairs_select ON public.user_language_pairs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_lang_pairs_insert ON public.user_language_pairs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_lang_pairs_update ON public.user_language_pairs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
