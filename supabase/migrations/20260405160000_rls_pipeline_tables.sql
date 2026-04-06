-- user_profiles: fill SELECT and UPDATE gaps (INSERT policy already exists)
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- languages: authenticated read-only (reference data; writes via service role only)
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY languages_select ON public.languages
  FOR SELECT TO authenticated
  USING (true);

-- lemmas: authenticated read-only
ALTER TABLE public.lemmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY lemmas_select ON public.lemmas
  FOR SELECT TO authenticated
  USING (true);

-- translation_mappings: authenticated read-only
ALTER TABLE public.translation_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_mappings_select ON public.translation_mappings
  FOR SELECT TO authenticated
  USING (true);

-- language_pair_scores: authenticated read-only
ALTER TABLE public.language_pair_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY language_pair_scores_select ON public.language_pair_scores
  FOR SELECT TO authenticated
  USING (true);

-- user_progression: users can SELECT their own rows; writes go through the
-- process-text edge function using the service-role key (bypasses RLS)
ALTER TABLE public.user_progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_progression_select_own ON public.user_progression
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- user_language_pairs: full CRUD on own rows
ALTER TABLE public.user_language_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_language_pairs_select_own ON public.user_language_pairs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY user_language_pairs_insert_own ON public.user_language_pairs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_language_pairs_update_own ON public.user_language_pairs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY user_language_pairs_delete_own ON public.user_language_pairs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
