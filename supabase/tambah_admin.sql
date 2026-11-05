-- =====================================================================
-- TAMBAH AKUN ADMIN (email + password) - jalankan di Supabase > SQL Editor
-- 1) Ganti 2 nilai di bawah (email dan password), lalu klik Run.
-- 2) Aman dijalankan ulang: kalau email sudah ada, hanya password dan
--    peran diperbarui.
-- Syarat: setup_login_portal.sql sudah pernah dijalankan.
-- =====================================================================
do $$
declare
  v_email    text := 'dimasprasetyo2310@gmail.com';   -- <- email akun admin
  v_password text := 'GANTI-PASSWORD-ANDA';           -- <- password, minimal 6 karakter
  v_id uuid;
begin
  if length(v_password) < 6 or v_password = 'GANTI-PASSWORD-ANDA' then
    raise exception 'Isi v_password dengan password Anda sendiri (minimal 6 karakter).';
  end if;

  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      lower(v_email), extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text, 'email',
      jsonb_build_object('sub', v_id::text, 'email', lower(v_email), 'email_verified', true),
      now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_id;
  end if;

  -- peran admin (trigger sudah membuat baris viewer; di sini dinaikkan)
  insert into public.user_roles (user_id, email, role)
  values (v_id, lower(v_email), 'admin')
  on conflict (user_id) do update set role = 'admin', email = excluded.email;
end $$;

-- Cek hasilnya:
select email, role from public.user_roles order by created_at;
