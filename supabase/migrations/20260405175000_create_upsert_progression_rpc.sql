-- Batch upsert for user_progression.
-- Takes arrays of lemma IDs and initial scores plus a bump applied on conflict.
-- SECURITY DEFINER so it runs as the function owner regardless of RLS,
-- removing any need for a service-role client in the edge function.
-- The p_user_id argument enforces per-user scoping within the function body.

CREATE OR REPLACE FUNCTION upsert_progression(
  p_user_id  uuid,
  p_lemma_ids uuid[],
  p_scores    numeric[],
  p_bump      numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_progression (user_id, lemma_id, progression_score, exposure_count, last_seen_at)
  SELECT p_user_id, unnest(p_lemma_ids), unnest(p_scores), 1, now()
  ON CONFLICT (user_id, lemma_id) DO UPDATE SET
    exposure_count    = user_progression.exposure_count + 1,
    last_seen_at      = now(),
    progression_score = LEAST(user_progression.progression_score + p_bump, 1.0);
END;
$$;

REVOKE ALL ON FUNCTION upsert_progression(uuid, uuid[], numeric[], numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_progression(uuid, uuid[], numeric[], numeric) TO authenticated;
