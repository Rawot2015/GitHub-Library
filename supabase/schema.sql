-- RepoShelf V2: run this script in Supabase SQL Editor.
-- After creating the first Auth user, replace the placeholder UUID below
-- only if you want to restrict the database to a single account at database level.
create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_name text not null check (char_length(project_name) between 1 and 255),
  description text not null default '',
  category text not null default 'Other',
  github_url text not null,
  technology text,
  tags text[] not null default '{}',
  status text not null default 'Active' check (status in ('Active','Archived','Planned')),
  stars integer not null default 0 check (stars >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists repositories_owner_updated_idx
  on public.repositories(owner, updated_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists repositories_updated_at on public.repositories;
create trigger repositories_updated_at before update on public.repositories
for each row execute function public.set_updated_at();

alter table public.repositories enable row level security;

drop policy if exists "Owners can read their repositories" on public.repositories;
create policy "Owners can read their repositories" on public.repositories
for select to authenticated using (auth.uid() = owner);

drop policy if exists "Owners can insert their repositories" on public.repositories;
create policy "Owners can insert their repositories" on public.repositories
for insert to authenticated with check (auth.uid() = owner);

drop policy if exists "Owners can update their repositories" on public.repositories;
create policy "Owners can update their repositories" on public.repositories
for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "Owners can delete their repositories" on public.repositories;
create policy "Owners can delete their repositories" on public.repositories
for delete to authenticated using (auth.uid() = owner);

grant select, insert, update, delete on public.repositories to authenticated;
revoke all on public.repositories from anon;
