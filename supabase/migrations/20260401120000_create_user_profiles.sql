-- App profile: one row per auth user.
-- API uses the Supabase publishable key + the end-user JWT so RLS applies (auth.uid() = user_id).
-- Service role bypasses RLS; use it only for break-glass tooling, not routine profile CRUD in apps/api.

create table public.user_profiles (
    user_id uuid not null primary key references auth.users (id) on delete cascade,
    email text not null,
    name text,
    avatar_url text,
    target_language text,
    proficiency_level integer not null default 0,
    onboarding_complete boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.user_profiles is 'Application user profile keyed by auth.users.id';

create index user_profiles_email_lower_idx on public.user_profiles (lower(email));

-- Keep updated_at in sync on row updates (repository also sends timestamps; trigger is a safety net).
create or replace function public.touch_user_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := pg_catalog.now();
    return new;
end;
$$;

create trigger user_profiles_touch_updated_at
    before update on public.user_profiles
    for each row
    execute function public.touch_user_profiles_updated_at();

alter table public.user_profiles enable row level security;

-- JWT-authenticated clients: own row only. Service role (API secret key) bypasses RLS.
create policy "user_profiles_select_own"
    on public.user_profiles
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
    on public.user_profiles
    for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
    on public.user_profiles
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "user_profiles_delete_own"
    on public.user_profiles
    for delete
    to authenticated
    using (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_profiles to authenticated;
grant all on table public.user_profiles to service_role;
