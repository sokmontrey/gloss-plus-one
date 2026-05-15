INSERT INTO public.languages (code, name, description) VALUES
  ('en', 'English', 'English language'),
  ('fr', 'French', 'French language'),
  ('es', 'Spanish', 'Spanish language')
ON CONFLICT (code) DO NOTHING;
