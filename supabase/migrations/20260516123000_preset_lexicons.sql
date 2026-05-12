-- preset_lexicons (renamed from legacy initial_words). preset_type ∈ {content, functional}.

DO $preset$
BEGIN
  IF to_regclass('public.initial_words') IS NOT NULL
     AND to_regclass('public.preset_lexicons') IS NULL
  THEN
    ALTER TABLE public.initial_words RENAME TO preset_lexicons;

    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'initial_words_language_code_idx'
    ) THEN
      ALTER INDEX public.initial_words_language_code_idx RENAME TO preset_lexicons_language_code_idx;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'preset_lexicons'
        AND con.conname = 'initial_words_pkey'
    ) THEN
      ALTER TABLE public.preset_lexicons RENAME CONSTRAINT initial_words_pkey TO preset_lexicons_pkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'preset_lexicons'
        AND con.conname = 'initial_words_progression_range'
    ) THEN
      ALTER TABLE public.preset_lexicons
        RENAME CONSTRAINT initial_words_progression_range TO preset_lexicons_progression_range;
    END IF;

    DROP POLICY IF EXISTS initial_words_select_pub ON public.preset_lexicons;

    ALTER TABLE public.preset_lexicons
      ADD COLUMN preset_type text NOT NULL DEFAULT 'content' CHECK (
        preset_type IN ('content', 'functional')
      );

    COMMENT ON COLUMN public.preset_lexicons.preset_type IS 'Lexicon slice: content (page-like) vs functional (UI/chrome).';

    ALTER TABLE public.preset_lexicons ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS preset_lexicons_select_pub ON public.preset_lexicons;

    CREATE POLICY preset_lexicons_select_pub
      ON public.preset_lexicons
      FOR SELECT TO anon, authenticated
      USING (true);

    GRANT SELECT ON public.preset_lexicons TO anon;
    GRANT SELECT ON public.preset_lexicons TO authenticated;

    RETURN;
  END IF;

  IF to_regclass('public.preset_lexicons') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'preset_lexicons'
        AND c.column_name = 'preset_type'
    ) THEN
      ALTER TABLE public.preset_lexicons
        ADD COLUMN preset_type text NOT NULL DEFAULT 'content' CHECK (
          preset_type IN ('content', 'functional')
        );
      COMMENT ON COLUMN public.preset_lexicons.preset_type IS 'Lexicon slice: content vs functional.';
    END IF;
    RETURN;
  END IF;

  CREATE TABLE public.preset_lexicons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code text NOT NULL REFERENCES public.languages (code) ON DELETE CASCADE,
    preset_type text NOT NULL DEFAULT 'content' CHECK (
      preset_type IN ('content', 'functional')
    ),
    initial_progression_score double precision NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT preset_lexicons_progression_range CHECK (
      initial_progression_score >= 0
      AND initial_progression_score <= 1
    )
  );

  CREATE INDEX preset_lexicons_language_code_idx ON public.preset_lexicons (language_code);

  COMMENT ON COLUMN public.preset_lexicons.language_code IS 'FK to languages.code.';
  COMMENT ON COLUMN public.preset_lexicons.preset_type IS 'Lexicon slice: content (page-like) vs functional (UI/chrome).';

  ALTER TABLE public.preset_lexicons ENABLE ROW LEVEL SECURITY;

  CREATE POLICY preset_lexicons_select_pub
    ON public.preset_lexicons
    FOR SELECT TO anon, authenticated
    USING (true);

  GRANT SELECT ON public.preset_lexicons TO anon;
  GRANT SELECT ON public.preset_lexicons TO authenticated;
END;
$preset$;
