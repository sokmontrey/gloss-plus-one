-- Per-user pipeline / UX tuning (1:1 with auth.users). NULL = use service default (env / code).
CREATE TABLE public.user_progressions (
  user_id uuid NOT NULL,
  min_combined_confidence double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_progressions_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_progressions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_progressions_min_combined_confidence_chk CHECK (
    min_combined_confidence IS NULL
    OR (min_combined_confidence >= 0::double precision AND min_combined_confidence <= 1::double precision)
  )
);

COMMENT ON TABLE public.user_progressions IS 'Optional per-user replace pipeline tuning; NULLs fall back to env/code defaults.';
COMMENT ON COLUMN public.user_progressions.min_combined_confidence IS 'Min fused combined confidence (0–1) to mark a token replaceable; overrides REPLACE_THRESHOLD_* env when set.';

CREATE OR REPLACE FUNCTION public.set_user_progressions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_progressions_set_updated_at
  BEFORE UPDATE ON public.user_progressions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_progressions_updated_at();

-- Existing profiles from before this migration
INSERT INTO public.user_progressions (user_id)
SELECT user_id FROM public.user_profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.user_progressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_progressions_select_own
  ON public.user_progressions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_progressions_insert_own
  ON public.user_progressions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_progressions_update_own
  ON public.user_progressions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_progressions TO authenticated;

-- Extend signup hook so new users get a progression row (same pattern as user_profiles).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_progressions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
