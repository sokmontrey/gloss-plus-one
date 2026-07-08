-- Change default learning target to Portuguese (`pt`, ISO 639-1).

-- 1. Ensure `pt` exists in the languages table (required by the FK constraint).
INSERT INTO public.languages (code, name, description) VALUES
  ('pt', 'Portuguese', 'Portuguese language')
ON CONFLICT (code) DO NOTHING;

-- 2. Update the column default.
ALTER TABLE public.user_profiles
  ALTER COLUMN target_language SET DEFAULT 'pt';

-- 3. Update the signup trigger so new users get `pt` instead of `fr`.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, name, target_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), ''),
    'pt'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
