-- Sudah dijalankan di proyek Supabase Anda (migration "monitoring_sales_bulanan_store_tables").
-- Salinan untuk arsip atau proyek baru. Membutuhkan public.app_role() dari schema.sql.
create table if not exists public.store_daily (
  store_code text not null default '10005',
  sale_date date not null,
  nav_sales numeric not null default 0,
  nav_trx integer not null default 0,
  ffc_sales numeric not null default 0,
  ffc_trx integer not null default 0,
  counter_in integer not null default 0,
  counter_out integer not null default 0,
  source text,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now(),
  primary key (store_code, sale_date)
);
create table if not exists public.store_day_category (
  store_code text not null default '10005',
  sale_date date not null,
  category text not null,
  sales numeric not null default 0,
  source text,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now(),
  primary key (store_code, sale_date, category)
);
alter table public.store_daily enable row level security;
alter table public.store_day_category enable row level security;

create policy store_daily_select on public.store_daily for select to authenticated using (public.app_role() is not null);
create policy store_daily_insert on public.store_daily for insert to authenticated with check (public.app_role() in ('admin','editor'));
create policy store_daily_update on public.store_daily for update to authenticated using (public.app_role() in ('admin','editor')) with check (public.app_role() in ('admin','editor'));
create policy store_daily_delete on public.store_daily for delete to authenticated using (public.app_role() in ('admin','editor'));

create policy store_cat_select on public.store_day_category for select to authenticated using (public.app_role() is not null);
create policy store_cat_insert on public.store_day_category for insert to authenticated with check (public.app_role() in ('admin','editor'));
create policy store_cat_update on public.store_day_category for update to authenticated using (public.app_role() in ('admin','editor')) with check (public.app_role() in ('admin','editor'));
create policy store_cat_delete on public.store_day_category for delete to authenticated using (public.app_role() in ('admin','editor'));
