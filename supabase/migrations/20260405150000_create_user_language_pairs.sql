CREATE TABLE public.user_language_pairs (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_language_id char(2)     NOT NULL REFERENCES public.languages(id),
  target_language_id char(2)     NOT NULL REFERENCES public.languages(id),
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_language_id, target_language_id)
);

CREATE INDEX idx_user_language_pairs_user_active
  ON public.user_language_pairs (user_id, is_active);
