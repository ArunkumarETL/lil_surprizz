create table if not exists public.box_colours (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.box_colours (name, sort_order) values
  ('Blush pink', 10),
  ('Lavender', 20),
  ('Cream', 30)
on conflict (name) do nothing;

create index if not exists box_colours_active_sort_idx on public.box_colours(active, sort_order, name);

alter table public.box_colours enable row level security;

drop policy if exists "Public can view active box colours" on public.box_colours;
create policy "Public can view active box colours" on public.box_colours
  for select using (active or public.is_admin());

drop policy if exists "Admins manage box colours" on public.box_colours;
create policy "Admins manage box colours" on public.box_colours
  for all using (public.is_admin()) with check (public.is_admin());
