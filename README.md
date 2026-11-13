# Dashboard Pencapaian Salesperson (MITRA10 Percetakan Negara)

## Alamat situs (GitHub Pages)

- Beranda: https://dimasprasetyo2310.github.io/pcn/
- Dashboard Salesperson: https://dimasprasetyo2310.github.io/pcn/dashboard.html
- Follow Up Customer: https://dimasprasetyo2310.github.io/pcn/followup.html
- Setiap push ke `main` diterbitkan otomatis oleh `.github/workflows/pages.yml`.
- Link tim sales (hanya baca, tanpa login): `dashboard.html?t=TOKEN`. Token dikelola di tabel `share_links` (lihat `supabase/tim_share_link.sql`); token tidak disimpan di repo.

Situs statis dengan login Supabase. Tidak perlu npm install atau bundler.

```
public/
  index.html        mengarah ke login
  login.html        halaman masuk
  dashboard.html    dashboard (menjaga sesi, menampilkan peran)
  config.js         URL dan publishable key Supabase
  js/login.js
  js/dashboard.js
  monitoring.html   monitoring sales bulanan level toko (traffic, invoice, basket size, sales)
  js/monitoring.js
supabase/schema.sql tabel dan aturan akses (sudah dijalankan di proyek Anda)
build-config.js     menulis public/config.js dari environment variables
```

## Peran
- admin: melihat, mengunggah, menghapus data, dan mengatur peran.
- editor: melihat, mengunggah, dan menghapus data.
- viewer: hanya melihat. User baru otomatis menjadi viewer.

## Langkah pemasangan
1. Supabase, Authentication, Sign In / Providers, Email: matikan "Allow new users to sign up" supaya hanya user buatan Anda yang bisa masuk.
2. Authentication, Users, Add user: buat akun untuk Anda dan tim (centang Auto Confirm User).
3. Jadikan akun Anda admin lewat SQL Editor: `select public.set_user_role('EMAIL-ANDA','admin');` (fungsi ada di supabase/setup_login_portal.sql).
   `update public.user_roles set role='admin' where email='EMAIL-ANDA';`
   Untuk editor: `update public.user_roles set role='editor' where email='EMAIL-TIM';`
4. Pasang situs:
   - Vercel atau Netlify: hubungkan folder ini, isi environment variable
     `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
     Build command `node build-config.js`, publish directory `public` (sudah diatur di vercel.json dan netlify.toml).
   - Cloudflare Pages (gratis): Workers & Pages, Create, Pages, Connect to Git, pilih repo ini. Framework preset `None`, build command dikosongkan, build output directory `public`. `public/config.js` sudah berisi alamat dan kunci publik Supabase, jadi environment variable tidak perlu diisi. Setelah alamat baru jadi, tambahkan alamat itu di Supabase, Authentication, URL Configuration (Site URL dan Redirect URLs).
   - Tanpa build: edit `public/config.js` lalu unggah folder `public` ke hosting statis apa pun.
5. Buka situs, masuk sebagai admin, lalu unggah file penjualan (misalnya salesperson_mtd.xlsx) dan file jadwal (SCHEDULE_NOV_SALES.xlsx).

Mencoba di komputer sendiri: isi `public/config.js`, lalu `npx serve public` dan buka alamat yang ditampilkan.

## Monitoring sales bulanan (level toko)
Halaman `monitoring.html` memakai login dan peran yang sama. Datanya dari tabel `store_daily` dan `store_day_category` (lihat `supabase/monitoring_store.sql`).
Admin dan editor mengunggah dua file: Report Compare FFC and Nav (traffic, invoice, sales NAV dan FFC) dan Sales Detail Report (sales per kategori). Data pada tanggal yang sama diganti.

## Follow up customer
Halaman `followup.html` (`js/followup.js`) memakai login yang sama. Tabel: `fu_customers`, `fu_logs`, `fu_salespeople` (lihat `supabase/followup_customer.sql`).
- Admin dan editor melihat semua customer, mengimpor Excel, dan menghapus customer.
- Akun sales (peran viewer) hanya melihat customer dengan nama salesperson yang dipetakan ke email login-nya.
- Sales masuk dengan ID Salesperson (atau angkanya saja) + PIN 6 angka; akunnya berupa email buatan `<id>@sales.mitra10pcn.id`. Sales bisa mengganti PIN sendiri (tombol "Ganti PIN").
- Admin memetakan nama salesperson ke ID/email, membuat akun, atau mereset PIN lewat tombol "Akun Salesperson".
- Kolom `member_no` (No Member) dipakai untuk mencegah data dobel saat impor.
- Data customer (no. HP) hanya ada di Supabase, tidak disimpan di repo.
