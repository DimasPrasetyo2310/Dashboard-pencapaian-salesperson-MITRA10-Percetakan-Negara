-- =====================================================================
-- SETUP PORTAL LOGIN USER - Dashboard Pencapaian Salesperson
-- Jalankan seluruh isi file ini di Supabase > SQL Editor > Run.
-- Aman dijalankan berulang kali (idempotent).
-- Login memakai Supabase Auth (email + password); file ini mengatur
-- PERAN user dan hak akses data.
-- =====================================================================

-- 1. Tabel peran user -------------------------------------------------
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'viewer' check (role in ('admin','editor','viewer')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

-- 2. Fungsi pembaca peran (dipakai aturan akses) -----------------------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;
revoke all on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

-- 3. Tabel data dashboard ---------------------------------------------
create table if not exists public.dashboard_days (
  store_code  text not null default '10005',
  sale_date   date not null,
  doc         jsonb not null,
  source      text,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now(),
  primary key (store_code, sale_date)
);
create table if not exists public.dashboard_schedule (
  store_code  text primary key default '10005',
  doc         jsonb not null,
  source      text,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now()
);
alter table public.dashboard_days     enable row level security;
alter table public.dashboard_schedule enable row level security;

-- 4. Aturan akses (RLS) -----------------------------------------------
-- user_roles: user melihat peran sendiri; admin mengatur semua
drop policy if exists roles_select      on public.user_roles;
drop policy if exists roles_admin_write on public.user_roles;
create policy roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.app_role() = 'admin');
create policy roles_admin_write on public.user_roles for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- data penjualan: semua yang punya peran boleh melihat;
-- hanya admin dan editor yang boleh menambah, mengubah, menghapus
drop policy if exists days_select on public.dashboard_days;
drop policy if exists days_insert on public.dashboard_days;
drop policy if exists days_update on public.dashboard_days;
drop policy if exists days_delete on public.dashboard_days;
create policy days_select on public.dashboard_days for select to authenticated using (public.app_role() is not null);
create policy days_insert on public.dashboard_days for insert to authenticated with check (public.app_role() in ('admin','editor'));
create policy days_update on public.dashboard_days for update to authenticated using (public.app_role() in ('admin','editor')) with check (public.app_role() in ('admin','editor'));
create policy days_delete on public.dashboard_days for delete to authenticated using (public.app_role() in ('admin','editor'));

drop policy if exists sched_select on public.dashboard_schedule;
drop policy if exists sched_insert on public.dashboard_schedule;
drop policy if exists sched_update on public.dashboard_schedule;
drop policy if exists sched_delete on public.dashboard_schedule;
create policy sched_select on public.dashboard_schedule for select to authenticated using (public.app_role() is not null);
create policy sched_insert on public.dashboard_schedule for insert to authenticated with check (public.app_role() in ('admin','editor'));
create policy sched_update on public.dashboard_schedule for update to authenticated using (public.app_role() in ('admin','editor')) with check (public.app_role() in ('admin','editor'));
create policy sched_delete on public.dashboard_schedule for delete to authenticated using (public.app_role() in ('admin','editor'));

-- 5. User baru otomatis jadi viewer ------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Isi peran untuk user yang sudah ada sebelum file ini dijalankan ---
insert into public.user_roles (user_id, email, role)
select id, email, 'viewer' from auth.users
on conflict (user_id) do nothing;

-- 7. Fungsi bantu: ubah peran lewat email -------------------------------
-- Dari SQL Editor (tanpa login aplikasi) fungsi ini dipakai langsung.
-- Dari aplikasi, hanya admin yang boleh memanggilnya.
create or replace function public.set_user_role(p_email text, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_role not in ('admin','editor','viewer') then
    raise exception 'Peran harus admin, editor, atau viewer';
  end if;
  if auth.uid() is not null and coalesce(public.app_role(),'') <> 'admin' then
    raise exception 'Hanya admin yang boleh mengubah peran';
  end if;
  update public.user_roles set role = p_role where lower(email) = lower(p_email);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Email % belum terdaftar. Buat user dulu di Authentication > Users', p_email; end if;
  return p_email || ' sekarang ' || p_role;
end $$;
revoke all on function public.set_user_role(text,text) from public, anon;
grant execute on function public.set_user_role(text,text) to authenticated;

-- 8. Realtime: perubahan data langsung tampil di semua perangkat --------
do $$ begin
  begin alter publication supabase_realtime add table public.dashboard_days;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.dashboard_schedule; exception when duplicate_object then null; end;
end $$;

-- =====================================================================
-- CARA PAKAI SETELAH FILE DI ATAS DIJALANKAN
-- =====================================================================
-- A. Buat akun: Authentication > Users > Add user (isi email + password,
--    centang Auto Confirm User). Matikan sign-up bebas di
--    Authentication > Sign In / Providers > Email > "Allow new users to sign up".
-- B. Jadikan admin / editor (ganti emailnya, lalu jalankan barisnya):
--      select public.set_user_role('email-anda@contoh.com', 'admin');
--      select public.set_user_role('email-tim@contoh.com',  'editor');
--      select public.set_user_role('email-lain@contoh.com', 'viewer');
-- C. Lihat daftar user dan perannya:
--      select email, role, created_at from public.user_roles order by created_at;
-- D. Cabut akses seseorang: hapus akunnya di Authentication > Users
--    (barisnya di user_roles ikut terhapus).
-- =====================================================================
