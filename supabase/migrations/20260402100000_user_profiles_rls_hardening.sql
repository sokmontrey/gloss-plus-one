-- user_profiles RLS policies and grants live in 20260401120000_create_user_profiles.sql.
-- This migration tightens defaults: anonymous clients must not access profile rows (defense in depth).

revoke all on table public.user_profiles from anon;
