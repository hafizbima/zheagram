-- Run this in Supabase SQL Editor.

create table if not exists public.boards (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Board',
  thumbnail_url text,
  folder_id text,
  is_favorite boolean not null default false,
  data jsonb not null default '{"objects": {}, "order": []}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists boards_owner_updated_idx
  on public.boards (owner_id, updated_at desc);

alter table public.boards enable row level security;

drop policy if exists "Users can read their own boards" on public.boards;
create policy "Users can read their own boards"
  on public.boards for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can create their own boards" on public.boards;
create policy "Users can create their own boards"
  on public.boards for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own boards" on public.boards;
create policy "Users can update their own boards"
  on public.boards for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own boards" on public.boards;
create policy "Users can delete their own boards"
  on public.boards for delete
  using (auth.uid() = owner_id);
