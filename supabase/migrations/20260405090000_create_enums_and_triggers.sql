-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE pos_tag AS ENUM (
  'noun', 'verb', 'adj', 'adv',
  'prep', 'conj', 'det', 'pron',
  'aux', 'part', 'intj', 'num'
);

CREATE TYPE word_category AS ENUM ('function', 'content');

CREATE TYPE expression_type AS ENUM (
  'idiom', 'phrasal_verb', 'collocation', 'compound'
);

CREATE TYPE grammar_category AS ENUM (
  'inflection', 'derivation', 'conjugation', 'syntax'
);

CREATE TYPE segment_type AS ENUM ('l1', 'known_l2', 'new_l2');

-- =============================================================================
-- HELPER: updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
