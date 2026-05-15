CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  target_language text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
);
