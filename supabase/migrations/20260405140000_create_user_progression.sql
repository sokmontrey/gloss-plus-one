CREATE TABLE public.user_progression (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma_id          uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  progression_score numeric(4,3) DEFAULT 0.000,
  exposure_count    integer      DEFAULT 0,
  last_seen_at      timestamptz,
  first_seen_at     timestamptz  DEFAULT now(),
  created_at        timestamptz  DEFAULT now(),
  updated_at        timestamptz  DEFAULT now(),

  UNIQUE (user_id, lemma_id)
);

CREATE INDEX idx_user_prog_user   ON public.user_progression (user_id);
CREATE INDEX idx_user_prog_lookup ON public.user_progression (user_id, lemma_id);
CREATE INDEX idx_user_prog_score  ON public.user_progression (user_id, progression_score);

CREATE TRIGGER trg_user_progression_updated
  BEFORE UPDATE ON public.user_progression
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.user_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_prog_select ON public.user_progression
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_prog_insert ON public.user_progression
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_prog_update ON public.user_progression
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
