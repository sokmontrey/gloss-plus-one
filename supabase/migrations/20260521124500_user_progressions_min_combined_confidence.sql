-- Collapse legacy recoverability + replace columns into min_combined_confidence (skip if table was created with new schema only).
DO $m$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_progressions'
      AND column_name = 'replace_threshold'
  ) THEN
    ALTER TABLE public.user_progressions ADD COLUMN IF NOT EXISTS min_combined_confidence double precision;
    UPDATE public.user_progressions
    SET min_combined_confidence = COALESCE(replace_threshold, recoverability_threshold);
    ALTER TABLE public.user_progressions DROP CONSTRAINT IF EXISTS user_progressions_recoverability_threshold_chk;
    ALTER TABLE public.user_progressions DROP CONSTRAINT IF EXISTS user_progressions_replace_threshold_chk;
    ALTER TABLE public.user_progressions DROP COLUMN recoverability_threshold;
    ALTER TABLE public.user_progressions DROP COLUMN replace_threshold;
    ALTER TABLE public.user_progressions DROP CONSTRAINT IF EXISTS user_progressions_min_combined_confidence_chk;
    ALTER TABLE public.user_progressions ADD CONSTRAINT user_progressions_min_combined_confidence_chk CHECK (
      min_combined_confidence IS NULL
      OR (min_combined_confidence >= 0::double precision AND min_combined_confidence <= 1::double precision)
    );
    COMMENT ON COLUMN public.user_progressions.min_combined_confidence IS 'Min fused combined confidence (0–1) to mark a token replaceable; overrides REPLACE_THRESHOLD_* env when set.';
    COMMENT ON TABLE public.user_progressions IS 'Optional per-user replace pipeline tuning; NULLs fall back to env/code defaults.';
  END IF;
END
$m$;
