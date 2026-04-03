CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  avatar_url text,
  target_language text,
  proficiency_level integer NOT NULL DEFAULT 0,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
);
