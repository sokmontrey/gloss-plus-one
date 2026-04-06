CREATE TABLE public.language_pair_scores (
  source_language_id char(2)      NOT NULL REFERENCES public.languages(id),
  target_language_id char(2)      NOT NULL REFERENCES public.languages(id),
  target_lemma_id    uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  base_score         numeric(5,4) NOT NULL,
  PRIMARY KEY (source_language_id, target_language_id, target_lemma_id)
);
