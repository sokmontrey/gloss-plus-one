CREATE TABLE public.translation_mappings (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lemma_id uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  target_lemma_id uuid         NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  confidence      numeric(3,2) DEFAULT 1.00,
  created_at      timestamptz  DEFAULT now(),

  UNIQUE (source_lemma_id, target_lemma_id)
);

CREATE INDEX idx_translation_source ON public.translation_mappings (source_lemma_id);
CREATE INDEX idx_translation_target ON public.translation_mappings (target_lemma_id);

ALTER TABLE public.translation_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY translations_read ON public.translation_mappings
  FOR SELECT TO authenticated
  USING (true);
