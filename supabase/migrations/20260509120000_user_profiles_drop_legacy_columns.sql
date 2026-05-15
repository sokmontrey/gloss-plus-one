-- Align existing DBs with slim user_profiles; safe if columns already absent.
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

  RETURN NEW;
END;
$$;

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS proficiency_level;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS onboarding_complete;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS updated_at;
