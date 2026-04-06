CREATE TABLE public.language_pair_scores (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_language_id uuid         NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  target_language_id uuid         NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  target_lemma_id    uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  base_score         numeric(3,2) DEFAULT 0.00,

  UNIQUE (source_language_id, target_language_id, target_lemma_id)
);

CREATE INDEX idx_pair_scores_lookup
  ON public.language_pair_scores (source_language_id, target_language_id);

ALTER TABLE public.language_pair_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY pair_scores_read ON public.language_pair_scores
  FOR SELECT TO authenticated
  USING (true);
