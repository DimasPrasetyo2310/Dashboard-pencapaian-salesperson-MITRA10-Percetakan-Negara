// Menulis public/config.js dari environment variables saat build (Vercel/Netlify).
// Jika environment variables tidak diisi, public/config.js yang sudah ada di repo dipakai apa adanya.
// Tanpa dependency. Jalankan: node build-config.js
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, 'public', 'config.js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  if (fs.existsSync(target)) {
    console.log('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY tidak diisi; memakai public/config.js yang sudah ada.');
    process.exit(0);
  }
  console.error('NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY harus diisi (atau sediakan public/config.js).');
  process.exit(1);
}
const out = 'window.APP_CONFIG = ' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key }, null, 2) + ';\n';
fs.writeFileSync(target, out);
console.log('public/config.js ditulis.');
