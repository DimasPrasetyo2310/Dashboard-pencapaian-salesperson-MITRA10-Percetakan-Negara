// Menulis public/config.js dari environment variables saat build (Vercel/Netlify).
// Tanpa dependency. Jalankan: node build-config.js
const fs = require('fs');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY harus diisi.');
  process.exit(1);
}
const out = 'window.APP_CONFIG = ' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key }, null, 2) + ';\n';
fs.writeFileSync(__dirname + '/public/config.js', out);
console.log('public/config.js ditulis.');
