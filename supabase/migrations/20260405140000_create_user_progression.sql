CREATE TABLE public.user_progression (
  user_id           uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma_id          uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  progression_score numeric(5,4) NOT NULL DEFAULT 0,
  exposure_count    integer      NOT NULL DEFAULT 0,
  last_seen_at      timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lemma_id)
);

CREATE INDEX idx_user_progression_user_id ON public.user_progression (user_id);
