CREATE TABLE public.lemmas (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id    uuid         NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  lemma          text         NOT NULL,
  pos            pos_tag      NOT NULL,
  frequency_rank integer,              -- lower = more common; from corpus data
  category       word_category NOT NULL DEFAULT 'content',
  created_at     timestamptz  DEFAULT now(),

  UNIQUE (language_id, lemma, pos)
);

CREATE INDEX idx_lemmas_language    ON public.lemmas (language_id);
CREATE INDEX idx_lemmas_frequency   ON public.lemmas (language_id, frequency_rank);
CREATE INDEX idx_lemmas_lookup      ON public.lemmas (language_id, lemma);

ALTER TABLE public.lemmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY lemmas_read ON public.lemmas
  FOR SELECT TO authenticated
  USING (true);
