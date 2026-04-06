-- =============================================================================
-- [STUB] WORD FAMILIES
-- Groups lemmas that share a root: "act", "action", "active", "activity".
-- Knowing one boosts progression of others via dampened transfer.
-- =============================================================================

CREATE TABLE public.word_families (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id uuid        NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  root_label  text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.word_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY word_families_read ON public.word_families
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.lemma_family_membership (
  lemma_id  uuid NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.word_families(id) ON DELETE CASCADE,
  PRIMARY KEY (lemma_id, family_id)
);

ALTER TABLE public.lemma_family_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY lemma_family_read ON public.lemma_family_membership
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- [STUB] LEMMA SENSES
-- Polysemy: "run" physical vs "run" a company.
-- =============================================================================

CREATE TABLE public.lemma_senses (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  lemma_id       uuid    NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  sense_key      text    NOT NULL,
  definition     text,
  frequency_rank integer,
  created_at     timestamptz DEFAULT now(),

  UNIQUE (lemma_id, sense_key)
);

ALTER TABLE public.lemma_senses ENABLE ROW LEVEL SECURITY;
CREATE POLICY lemma_senses_read ON public.lemma_senses
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- [STUB] EXPRESSIONS
-- Multi-word units: idioms, phrasal verbs, collocations.
-- =============================================================================

CREATE TABLE public.expressions (
  id             uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id    uuid            NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  surface_form   text            NOT NULL,
  canonical_form text            NOT NULL,
  type           expression_type NOT NULL,
  frequency_rank integer,
  created_at     timestamptz     DEFAULT now()
);

CREATE INDEX idx_expressions_language ON public.expressions (language_id);

ALTER TABLE public.expressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY expressions_read ON public.expressions
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.expression_components (
  expression_id uuid    NOT NULL REFERENCES public.expressions(id) ON DELETE CASCADE,
  lemma_id      uuid    NOT NULL REFERENCES public.lemmas(id) ON DELETE CASCADE,
  position      integer NOT NULL,
  PRIMARY KEY (expression_id, position)
);

ALTER TABLE public.expression_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY expr_components_read ON public.expression_components
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- [STUB] GRAMMAR PATTERNS
-- =============================================================================

CREATE TABLE public.grammar_patterns (
  id                   uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id          uuid             NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  pattern              text             NOT NULL,
  category             grammar_category NOT NULL,
  has_source_equivalent boolean         DEFAULT true,
  difficulty_tier      integer          DEFAULT 1,
  created_at           timestamptz      DEFAULT now()
);

ALTER TABLE public.grammar_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY grammar_patterns_read ON public.grammar_patterns
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- [STUB] CONCEPTS + REALIZATIONS
-- Language-agnostic meaning layer for non-1:1 mappings.
-- =============================================================================

CREATE TABLE public.concepts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  description text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY concepts_read ON public.concepts
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.concept_realizations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id    uuid        NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  language_id   uuid        NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  lemma_id      uuid        REFERENCES public.lemmas(id) ON DELETE SET NULL,
  expression_id uuid        REFERENCES public.expressions(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),

  CONSTRAINT realization_target CHECK (
    (lemma_id IS NOT NULL AND expression_id IS NULL) OR
    (lemma_id IS NULL AND expression_id IS NOT NULL)
  )
);

CREATE INDEX idx_realizations_concept  ON public.concept_realizations (concept_id);
CREATE INDEX idx_realizations_language ON public.concept_realizations (language_id);

ALTER TABLE public.concept_realizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY realizations_read ON public.concept_realizations
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- [STUB] USER EXPRESSION PROGRESSION
-- =============================================================================

CREATE TABLE public.user_expression_progression (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expression_id     uuid         NOT NULL REFERENCES public.expressions(id) ON DELETE CASCADE,
  progression_score numeric(4,3) DEFAULT 0.000,
  exposure_count    integer      DEFAULT 0,
  last_seen_at      timestamptz,
  first_seen_at     timestamptz  DEFAULT now(),
  created_at        timestamptz  DEFAULT now(),
  updated_at        timestamptz  DEFAULT now(),

  UNIQUE (user_id, expression_id)
);

CREATE TRIGGER trg_user_expr_prog_updated
  BEFORE UPDATE ON public.user_expression_progression
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.user_expression_progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_expr_prog_select ON public.user_expression_progression
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_expr_prog_insert ON public.user_expression_progression
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_expr_prog_update ON public.user_expression_progression
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- [STUB] USER GRAMMAR PROGRESSION
-- =============================================================================

CREATE TABLE public.user_grammar_progression (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id        uuid         NOT NULL REFERENCES public.grammar_patterns(id) ON DELETE CASCADE,
  progression_score numeric(4,3) DEFAULT 0.000,
  exposure_count    integer      DEFAULT 0,
  last_seen_at      timestamptz,
  first_seen_at     timestamptz  DEFAULT now(),
  created_at        timestamptz  DEFAULT now(),
  updated_at        timestamptz  DEFAULT now(),

  UNIQUE (user_id, pattern_id)
);

CREATE TRIGGER trg_user_grammar_prog_updated
  BEFORE UPDATE ON public.user_grammar_progression
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.user_grammar_progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_grammar_prog_select ON public.user_grammar_progression
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_grammar_prog_insert ON public.user_grammar_progression
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_grammar_prog_update ON public.user_grammar_progression
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
