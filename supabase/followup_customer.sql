-- =====================================================================
-- FOLLOW UP CUSTOMER - MITRA10 Percetakan Negara (10005)
-- Jalankan di Supabase > SQL Editor. Aman dijalankan berulang kali.
-- Syarat: setup_login_portal.sql sudah dijalankan (tabel user_roles dan fungsi app_role).
--
-- Akses:
--   admin & editor : melihat dan mengubah semua customer, impor data, hapus.
--   sales (viewer) : hanya customer dengan salesperson yang dipetakan ke email login-nya
--                    (tabel fu_salespeople), boleh menambah, mengubah, dan mencatat follow up.
-- =====================================================================

-- 1. Pemetaan nama salesperson -> email akun login ---------------------
create table if not exists public.fu_salespeople (
  name       text primary key,
  email      text,
  created_at timestamptz not null default now()
);

-- 2. Customer -----------------------------------------------------------
create table if not exists public.fu_customers (
  id          bigint generated always as identity primary key,
  store_code  text not null default '10005',
  nama        text not null,
  hp          text,
  salesperson text,
  status      text not null default 'Baru'
              check (status in ('Baru','Dihubungi','Penawaran','Deal','Batal')),
  next_date   date,
  potensi     numeric not null default 0,
  catatan     text,
  sumber      text,
  last_contact timestamptz,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists fu_customers_sales_idx on public.fu_customers (salesperson);
create index if not exists fu_customers_next_idx  on public.fu_customers (next_date);

-- 3. Riwayat follow up -------------------------------------------------
create table if not exists public.fu_logs (
  id          bigint generated always as identity primary key,
  customer_id bigint not null references public.fu_customers(id) on delete cascade,
  at          timestamptz not null default now(),
  cara        text,
  catatan     text,
  status      text,
  next_date   date,
  by_email    text default (auth.jwt() ->> 'email'),
  created_by  uuid default auth.uid()
);
create index if not exists fu_logs_customer_idx on public.fu_logs (customer_id, at desc);

alter table public.fu_salespeople enable row level security;
alter table public.fu_customers   enable row level security;
alter table public.fu_logs        enable row level security;

-- 4. Fungsi bantu -------------------------------------------------------
create or replace function public.fu_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('admin','editor'), false)
$$;
create or replace function public.fu_my_sales() returns setof text
language sql stable security definer set search_path = public as $$
  select name from public.fu_salespeople
  where email is not null and lower(email) = lower(auth.jwt() ->> 'email')
$$;
revoke all on function public.fu_is_manager() from public, anon;
revoke all on function public.fu_my_sales()   from public, anon;
grant execute on function public.fu_is_manager() to authenticated;
grant execute on function public.fu_my_sales()   to authenticated;

-- updated_at otomatis
create or replace function public.fu_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists fu_customers_touch on public.fu_customers;
create trigger fu_customers_touch before update on public.fu_customers
  for each row execute function public.fu_touch();

-- 5. Aturan akses (RLS) -------------------------------------------------
drop policy if exists fu_sp_select on public.fu_salespeople;
drop policy if exists fu_sp_write  on public.fu_salespeople;
create policy fu_sp_select on public.fu_salespeople for select to authenticated
  using (public.app_role() is not null);
create policy fu_sp_write on public.fu_salespeople for all to authenticated
  using (public.fu_is_manager()) with check (public.fu_is_manager());

drop policy if exists fu_c_select on public.fu_customers;
drop policy if exists fu_c_insert on public.fu_customers;
drop policy if exists fu_c_update on public.fu_customers;
drop policy if exists fu_c_delete on public.fu_customers;
create policy fu_c_select on public.fu_customers for select to authenticated
  using (public.fu_is_manager() or salesperson in (select public.fu_my_sales()));
create policy fu_c_insert on public.fu_customers for insert to authenticated
  with check (public.fu_is_manager() or salesperson in (select public.fu_my_sales()));
create policy fu_c_update on public.fu_customers for update to authenticated
  using (public.fu_is_manager() or salesperson in (select public.fu_my_sales()))
  with check (public.fu_is_manager() or salesperson in (select public.fu_my_sales()));
create policy fu_c_delete on public.fu_customers for delete to authenticated
  using (public.fu_is_manager());

drop policy if exists fu_l_select on public.fu_logs;
drop policy if exists fu_l_insert on public.fu_logs;
drop policy if exists fu_l_delete on public.fu_logs;
create policy fu_l_select on public.fu_logs for select to authenticated
  using (exists (select 1 from public.fu_customers c where c.id = customer_id));
create policy fu_l_insert on public.fu_logs for insert to authenticated
  with check (exists (select 1 from public.fu_customers c where c.id = customer_id));
create policy fu_l_delete on public.fu_logs for delete to authenticated
  using (public.fu_is_manager() or created_by = auth.uid());

-- 6. Realtime -----------------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.fu_customers; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.fu_logs;      exception when duplicate_object then null; end;
end $$;

-- 7. Admin membuat / reset akun login sales langsung dari halaman --------
--    Akun baru berperan viewer (hanya melihat customer miliknya).
create or replace function public.fu_upsert_sales_account(p_name text, p_email text, p_password text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_email text := lower(trim(p_email));
begin
  if coalesce(public.app_role(),'') <> 'admin' then raise exception 'Hanya admin yang boleh membuat akun'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Nama salesperson wajib diisi'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Format email tidak valid'; end if;
  select id into v_id from auth.users where lower(email) = v_email;
  if p_password is not null and p_password <> '' then
    if length(p_password) < 6 then raise exception 'Password minimal 6 karakter'; end if;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
        crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text, 'email',
        jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), now(), now(), now());
    else
      update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_id;
    end if;
  end if;
  insert into public.fu_salespeople(name, email) values (trim(p_name), v_email)
  on conflict (name) do update set email = excluded.email;
  return case when v_id is null then 'Email disimpan (akun belum dibuat, isi password untuk membuatnya)' else 'Akun ' || v_email || ' siap dipakai' end;
end $$;
revoke all on function public.fu_upsert_sales_account(text,text,text) from public, anon;
grant execute on function public.fu_upsert_sales_account(text,text,text) to authenticated;

-- =====================================================================
-- CARA PAKAI
-- A. Buat akun sales di Authentication > Users (atau pakai akun yang sudah ada).
-- B. Di halaman Follow Up Customer, admin membuka "Akun Salesperson", mengisi
--    email (dan password untuk membuat akun baru) untuk tiap nama salesperson. Bisa juga lewat SQL:
--      insert into public.fu_salespeople(name,email) values ('NAMA SALES','email@contoh.com')
--      on conflict (name) do update set email = excluded.email;
-- =====================================================================

-- Tambahan: nomor member (kunci anti-dobel saat impor) dan daftar nama sales awal
alter table public.fu_customers add column if not exists member_no text;
create unique index if not exists fu_customers_member_uq on public.fu_customers (member_no) where member_no is not null;
insert into public.fu_salespeople(name)
select distinct name from public.sales_person_day where role = 'Sales' and name is not null
on conflict (name) do nothing;

-- Login sales dengan ID Salesperson + PIN
-- Akun sales memakai email buatan: <id huruf kecil>@sales.mitra10pcn.id (mis. s10005-0000000699@sales.mitra10pcn.id).
-- Halaman login mengubah ID (atau angkanya saja, mis. 699) menjadi email tersebut.
alter table public.fu_salespeople add column if not exists sales_id text;
create unique index if not exists fu_salespeople_sid_uq on public.fu_salespeople (sales_id) where sales_id is not null;
create or replace function public.fu_sales_email(p_id text) returns text language sql immutable as $$
  select lower(trim(p_id)) || '@sales.mitra10pcn.id'
$$;
