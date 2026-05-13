-- One row per (user, language, surface value); removes duplicates then enforces UNIQUE.

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, language_code, value
      ORDER BY confident_score DESC, created_at DESC
    ) AS rn
  FROM public.user_lexicon_confidents
)
DELETE FROM public.user_lexicon_confidents u USING ranked r
WHERE u.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_lexicon_confidents_user_lang_value_uidx
  ON public.user_lexicon_confidents (user_id, language_code, value);
