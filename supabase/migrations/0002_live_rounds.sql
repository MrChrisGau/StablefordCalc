create table public.live_rounds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  course_id uuid not null,
  game_mode text not null default 'stableford',
  status text not null default 'in_progress',
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.live_round_players (
  id uuid primary key default gen_random_uuid(),
  live_round_id uuid not null references public.live_rounds(id) on delete cascade,
  player_id uuid not null,
  first_name text not null,
  last_name text not null,
  handicap numeric not null,
  gender text not null,
  tee_id uuid not null,
  claimed_by uuid,
  claimed_at timestamptz
);

create table public.live_round_scores (
  live_round_id uuid not null references public.live_rounds(id) on delete cascade,
  slot_id uuid not null references public.live_round_players(id) on delete cascade,
  hole_number smallint not null,
  strokes smallint,
  picked_up boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (slot_id, hole_number)
);

alter table public.live_rounds enable row level security;
alter table public.live_round_players enable row level security;
alter table public.live_round_scores enable row level security;

create policy "live_rounds_select_all" on public.live_rounds
  for select using (true);
create policy "live_rounds_insert_own" on public.live_rounds
  for insert to authenticated with check (created_by = auth.uid());
create policy "live_rounds_update_host" on public.live_rounds
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "live_players_select_all" on public.live_round_players
  for select using (true);
create policy "live_players_insert_by_creator" on public.live_round_players
  for insert to authenticated with check (
    exists (select 1 from public.live_rounds lr
            where lr.id = live_round_players.live_round_id and lr.created_by = auth.uid())
  );
create policy "live_players_claim_slot" on public.live_round_players
  for update to authenticated
  using (claimed_by is null or claimed_by = auth.uid())
  with check (claimed_by = auth.uid());

create policy "live_scores_select_all" on public.live_round_scores
  for select using (true);
create policy "live_scores_write_own_slot" on public.live_round_scores
  for insert to authenticated with check (
    exists (select 1 from public.live_round_players lrp
            where lrp.id = live_round_scores.slot_id and lrp.claimed_by = auth.uid())
  );
create policy "live_scores_update_own_slot" on public.live_round_scores
  for update to authenticated
  using (
    exists (select 1 from public.live_round_players lrp
            where lrp.id = live_round_scores.slot_id and lrp.claimed_by = auth.uid())
  )
  with check (
    exists (select 1 from public.live_round_players lrp
            where lrp.id = live_round_scores.slot_id and lrp.claimed_by = auth.uid())
  );

alter publication supabase_realtime add table public.live_rounds;
alter publication supabase_realtime add table public.live_round_players;
alter publication supabase_realtime add table public.live_round_scores;

create policy "live_rounds_delete_host" on public.live_rounds
  for delete to authenticated using (created_by = auth.uid());
