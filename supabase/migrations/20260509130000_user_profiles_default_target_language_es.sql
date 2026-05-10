-- Default learning target to Spanish (ISO 639-1 style code `es`).
ALTER TABLE public.user_profiles
  ALTER COLUMN target_language SET DEFAULT 'es';

UPDATE public.user_profiles
SET target_language = 'es'
WHERE target_language IS NULL;

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
    'es'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
