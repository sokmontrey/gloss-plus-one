-- Highlight tier columns belong on the frontend; remove if an older migration added them.
ALTER TABLE public.user_progressions DROP CONSTRAINT IF EXISTS user_progressions_highlight_order_chk;
ALTER TABLE public.user_progressions DROP CONSTRAINT IF EXISTS user_progressions_highlight_medium_min_chk;
ALTER TABLE public.user_progressions DROP CONSTRAINT IF EXISTS user_progressions_highlight_high_min_chk;
ALTER TABLE public.user_progressions DROP COLUMN IF EXISTS highlight_medium_min;
ALTER TABLE public.user_progressions DROP COLUMN IF EXISTS highlight_high_min;
