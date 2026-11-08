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

-- Budget bulanan per kategori dan persentase harian (sudah dibuat lewat migrasi monitoring_budget_tables):
-- public.store_budget_monthly (store_code, year, month, category, budget, source)
-- public.store_budget_phasing (store_code, phase_date, pct, source)

-- Rincian master brand per hari per kategori (migrasi store_day_brand):
-- public.store_day_brand (store_code, sale_date, category, master_brand, sales, source), RLS sama seperti store_day_category

-- Sales per Source Type Name dan Master Type Brand per hari (migrasi store_day_dim):
-- public.store_day_dim (store_code, sale_date, dim ['source'|'typebrand'], dim_value, sales, source), RLS sama

-- Arsip detail penjualan lengkap per hari (migrasi store_day_detail): kategori, sub kategori, function, sub function,
-- master brand, brand, source type, master type brand + sales (exclude/include), qty, jumlah baris. Dipakai agar fitur baru tidak butuh unggah ulang.

-- Detail item per hari per kategori dan master brand (migrasi store_day_item): item_no (tanpa nol di depan), item_name, qty, sales, lines

-- Kolom manual laporan WhatsApp harian (migrasi store_report_manual): traffic_manual, prot_qty_t/a, member_t/a per tanggal, RLS sama
-- store_report_manual.extra (jsonb): kolom manual Report Closing (clTt, clIt, clBt, clSm, clWi, clPdd, clOt, clD0-3, clLate)
