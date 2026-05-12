-- FK user_profiles.target_language → languages(code)

UPDATE public.user_profiles
SET target_language = lower(btrim(target_language))
WHERE target_language IS NOT NULL;

UPDATE public.user_profiles up
SET target_language = 'fr'
WHERE up.target_language IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.languages l WHERE l.code = up.target_language
  );

UPDATE public.user_profiles
SET target_language = 'fr'
WHERE target_language IS NULL;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_target_language_fkey
  FOREIGN KEY (target_language)
  REFERENCES public.languages (code)
  ON UPDATE CASCADE;
