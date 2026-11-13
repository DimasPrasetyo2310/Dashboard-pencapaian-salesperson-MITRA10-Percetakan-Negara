-- Template pesan WhatsApp untuk blasting (halaman Follow Up Customer).
-- Jalankan di Supabase > SQL Editor. Aman dijalankan berulang kali.
create table if not exists public.fu_templates (
  id         bigint generated always as identity primary key,
  judul      text not null,
  isi        text not null,
  aktif      boolean not null default true,
  urut       int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fu_templates enable row level security;
drop trigger if exists fu_templates_touch on public.fu_templates;
create trigger fu_templates_touch before update on public.fu_templates
  for each row execute function public.fu_touch();
drop policy if exists fu_t_select on public.fu_templates;
drop policy if exists fu_t_write  on public.fu_templates;
create policy fu_t_select on public.fu_templates for select to authenticated
  using ((select public.app_role()) is not null);
create policy fu_t_write on public.fu_templates for all to authenticated
  using ((select public.fu_is_manager())) with check ((select public.fu_is_manager()));
