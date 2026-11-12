-- RepoShelf feature migration: collections, assignment and private repository notes.
-- Run once in Supabase SQL Editor while signed in as the project owner.

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index if not exists collections_owner_name_unique
  on public.collections(owner, lower(name));

alter table public.repositories
  add column if not exists collection_id uuid references public.collections(id) on delete set null;

alter table public.repositories
  add column if not exists notes text not null default '';

create index if not exists repositories_owner_collection_idx
  on public.repositories(owner, collection_id);

alter table public.collections enable row level security;

drop policy if exists "Owners can read their collections" on public.collections;
create policy "Owners can read their collections" on public.collections
  for select to authenticated using (auth.uid() = owner);

drop policy if exists "Owners can insert their collections" on public.collections;
create policy "Owners can insert their collections" on public.collections
  for insert to authenticated with check (auth.uid() = owner);

drop policy if exists "Owners can update their collections" on public.collections;
create policy "Owners can update their collections" on public.collections
  for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "Owners can delete their collections" on public.collections;
create policy "Owners can delete their collections" on public.collections
  for delete to authenticated using (auth.uid() = owner);

grant select, insert, update, delete on public.collections to authenticated;
revoke all on public.collections from anon;

-- Prevent assigning another user's collection to a repository, even through direct API calls.
create or replace function public.validate_repository_collection_owner()
returns trigger language plpgsql security invoker as $$
begin
  if new.collection_id is not null and not exists (
    select 1 from public.collections c
    where c.id = new.collection_id and c.owner = new.owner
  ) then
    raise exception 'Collection must belong to the same user as the repository';
  end if;
  return new;
end;
$$;

drop trigger if exists repositories_validate_collection_owner on public.repositories;
create trigger repositories_validate_collection_owner
  before insert or update of collection_id, owner on public.repositories
  for each row execute function public.validate_repository_collection_owner();
