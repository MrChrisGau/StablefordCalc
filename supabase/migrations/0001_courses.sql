create table public.courses (
  id uuid primary key,
  name text not null,
  sort_key text not null default '',
  hole_count smallint not null,
  tees jsonb not null default '[]'::jsonb,
  holes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "courses_select_all" on public.courses
  for select using (true);

create policy "courses_write_authenticated" on public.courses
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.courses;
