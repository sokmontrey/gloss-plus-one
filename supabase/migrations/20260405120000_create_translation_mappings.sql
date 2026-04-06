CREATE TABLE public.translation_mappings (
  source_lemma_id uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  target_lemma_id uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  confidence      numeric(4,3) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  created_at      timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (source_lemma_id, target_lemma_id)
);
