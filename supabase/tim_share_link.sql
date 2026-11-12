-- Link tim sales (hanya baca, tanpa login): dashboard.html?t=TOKEN
-- Sudah dijalankan di Supabase. Disimpan di sini sebagai catatan.
create table if not exists public.share_links (token text primary key, store_code text not null, label text, revoked boolean not null default false, created_at timestamptz not null default now());
alter table public.share_links enable row level security;  -- tanpa policy: tidak bisa dibaca lewat API
create or replace function public.tim_view_data(p_token text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_store text; r jsonb;
begin
  select store_code into v_store from public.share_links where token = p_token and not revoked;
  if v_store is null then return null; end if;
  select jsonb_build_object('days', coalesce(jsonb_agg(jsonb_build_object('sale_date', sale_date, 'doc', doc - 'hours' - 'mb' - 'prot') order by sale_date), '[]'::jsonb),
    'sched', (select doc from public.dashboard_schedule where store_code::text = v_store limit 1)) into r
  from public.dashboard_days where store_code::text = v_store;
  return r;
end $$;
revoke all on function public.tim_view_data(text) from public;
grant execute on function public.tim_view_data(text) to anon, authenticated;
-- Buat link baru:  insert into public.share_links(token,store_code,label) values (replace(gen_random_uuid()::text,'-',''),'10005','Tim sales') returning token;
-- Matikan link:    update public.share_links set revoked = true where token = '...';
