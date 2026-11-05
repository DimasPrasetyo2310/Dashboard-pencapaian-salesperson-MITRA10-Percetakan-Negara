-- Sudah dijalankan di proyek Supabase Anda (migration "dashboard_portal_roles_and_data").
-- File ini hanya salinan untuk arsip atau untuk proyek baru.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;
revoke all on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

create table if not exists public.dashboard_days (
  store_code text not null default '10005',
  sale_date date not null,
  doc jsonb not null,
  source text,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now(),
  primary key (store_code, sale_date)
);
create table if not exists public.dashboard_schedule (
  store_code text primary key default '10005',
  doc jsonb not null,
  source text,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now()
);
alter table public.dashboard_days enable row level security;
alter table public.dashboard_schedule enable row level security;

create policy roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.app_role() = 'admin');
create policy roles_admin_write on public.user_roles for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy days_select on public.dashboard_days for select to authenticated using (public.app_role() is not null);
create policy days_insert on public.dashboard_days for insert to authenticated with check (public.app_role() in ('admin','editor'));
create policy days_update on public.dashboard_days for update to authenticated using (public.app_role() in ('admin','editor')) with check (public.app_role() in ('admin','editor'));
create policy days_delete on public.dashboard_days for delete to authenticated using (public.app_role() in ('admin','editor'));

create policy sched_select on public.dashboard_schedule for select to authenticated using (public.app_role() is not null);
create policy sched_insert on public.dashboard_schedule for insert to authenticated with check (public.app_role() in ('admin','editor'));
create policy sched_update on public.dashboard_schedule for update to authenticated using (public.app_role() in ('admin','editor')) with check (public.app_role() in ('admin','editor'));
create policy sched_delete on public.dashboard_schedule for delete to authenticated using (public.app_role() in ('admin','editor'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, email, role) values (new.id, new.email, 'viewer') on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.dashboard_days;
alter publication supabase_realtime add table public.dashboard_schedule;
