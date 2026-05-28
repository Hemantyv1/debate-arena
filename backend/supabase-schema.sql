

create table if not exists debates (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,
  status      text not null default 'pending'
                check (status in ('pending', 'in_progress', 'completed')),
  red_votes   integer not null default 0,
  blue_votes  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists rounds (
  id            uuid primary key default gen_random_uuid(),
  debate_id     uuid not null references debates(id) on delete cascade,
  round_number  integer not null check (round_number between 1 and 3),
  red_argument  text,
  blue_argument text,
  created_at    timestamptz not null default now(),
  unique (debate_id, round_number)
);

create index if not exists rounds_debate_id_idx on rounds(debate_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Debates and rounds are fully public — anyone may read and write via the anon key.

alter table debates enable row level security;
alter table rounds  enable row level security;

create policy "public read debates"  on debates for select using (true);
create policy "public insert debates" on debates for insert with check (true);
create policy "public update debates" on debates for update using (true);

create policy "public read rounds"   on rounds  for select using (true);
create policy "public insert rounds" on rounds  for insert with check (true);
create policy "public update rounds" on rounds  for update using (true);

-- Atomic vote increment — avoids read-modify-write race conditions
create or replace function increment_vote(p_debate_id uuid, p_agent text)
returns table(red_votes integer, blue_votes integer)
language plpgsql
as $$
begin
  if p_agent = 'red' then
    update debates set red_votes = debates.red_votes + 1 where id = p_debate_id;
  else
    update debates set blue_votes = debates.blue_votes + 1 where id = p_debate_id;
  end if;

  return query
    select d.red_votes, d.blue_votes
    from debates d
    where d.id = p_debate_id;
end;
$$;
