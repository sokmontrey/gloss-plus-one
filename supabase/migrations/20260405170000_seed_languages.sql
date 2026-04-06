INSERT INTO public.languages (code, name) VALUES
  ('en', 'English'),
  ('es', 'Spanish'),
  ('fr', 'French')
ON CONFLICT (code) DO NOTHING;
