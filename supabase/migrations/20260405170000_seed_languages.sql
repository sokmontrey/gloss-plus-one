INSERT INTO public.languages (id, name) VALUES
  ('en', 'English'),
  ('es', 'Spanish'),
  ('fr', 'French')
ON CONFLICT (id) DO NOTHING;
