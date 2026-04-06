CREATE TABLE public.processed_text_log (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_language_id uuid        NOT NULL REFERENCES public.languages(id),
  target_language_id uuid        NOT NULL REFERENCES public.languages(id),
  word_count         integer,
  words_replaced     integer,
  words_introduced   integer,
  source_url         text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_text_log_user ON public.processed_text_log (user_id);

ALTER TABLE public.processed_text_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY text_log_select ON public.processed_text_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY text_log_insert ON public.processed_text_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
