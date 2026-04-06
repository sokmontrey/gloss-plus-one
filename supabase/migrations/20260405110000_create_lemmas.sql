CREATE TABLE public.lemmas (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  language_id    char(2)     NOT NULL REFERENCES public.languages(id),
  lemma          text        NOT NULL,
  pos            text        NOT NULL,  -- 'noun','verb','adj','adv','det','conj','prep','pron','aux','part','num','unknown'
  category       text        NOT NULL CHECK (category IN ('function', 'content')),
  frequency_rank integer,               -- nullable; populated from corpus data later
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language_id, lemma, pos)
);

CREATE INDEX idx_lemmas_language_lemma ON public.lemmas (language_id, lemma);
