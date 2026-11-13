const CFG = window.APP_CONFIG || {};
const SUPABASE_URL = CFG.SUPABASE_URL;
const SUPABASE_KEY = CFG.SUPABASE_PUBLISHABLE_KEY;
const NEXT_ALLOWED = ['dashboard.html', 'monitoring.html', 'followup.html'];
let nextParam = new URLSearchParams(window.location.search).get('next');
try { if (!nextParam) nextParam = sessionStorage.getItem('mitra10_next'); } catch (e) {}
const DASHBOARD_URL = NEXT_ALLOWED.indexOf(nextParam) >= 0 ? nextParam : 'dashboard.html';
const SALES_DOMAIN = '@sales.mitra10pcn.id';
// ID Salesperson -> email akun: "699", "0000000699", atau "S10005-0000000699"
function toLoginEmail(v) {
  v = (v || '').trim();
  if (!v || v.indexOf('@') >= 0) return v;
  let m = v.toUpperCase().replace(/\s+/g, '');
  if (/^\d{1,10}$/.test(m)) m = 'S10005-' + m.padStart(10, '0');
  else if (/^S\d+-?\d+$/.test(m) && m.indexOf('-') < 0) m = m.slice(0, 6) + '-' + m.slice(6);
  return m.toLowerCase() + SALES_DOMAIN;
}
const targetFor = (email) => (email || '').toLowerCase().endsWith(SALES_DOMAIN) ? 'followup.html' : DASHBOARD_URL;

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('submit');

const sb = window.supabase && SUPABASE_URL && SUPABASE_KEY && !/YOUR-/.test(SUPABASE_URL) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

function setFieldError(input, errorEl, message) {
  errorEl.textContent = message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function validate(email, password) {
  let ok = true;
  if (!email) {
    setFieldError(emailInput, emailError, 'Email atau ID Salesperson wajib diisi.');
    ok = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toLoginEmail(email))) {
    setFieldError(emailInput, emailError, 'Format email tidak valid.');
    ok = false;
  } else {
    setFieldError(emailInput, emailError, '');
  }

  if (!password) {
    setFieldError(passwordInput, passwordError, 'Password / PIN wajib diisi.');
    ok = false;
  } else if (password.length < 6) {
    setFieldError(passwordInput, passwordError, 'Password / PIN minimal 6 karakter.');
    ok = false;
  } else {
    setFieldError(passwordInput, passwordError, '');
  }
  return ok;
}

function friendlyError(error) {
  const msg = (error && error.message) || '';
  if (/invalid login credentials/i.test(msg)) return 'Email/ID atau password/PIN salah.';
  if (/email not confirmed/i.test(msg)) return 'Email belum dikonfirmasi. Cek kotak masuk Anda.';
  if (/failed to fetch|network/i.test(msg)) return 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda.';
  return msg || 'Login gagal. Coba lagi.';
}

// Jika sudah login, langsung ke dashboard.
if (sb) {
  sb.auth.getSession().then(({ data }) => {
    if (data && data.session) window.location.replace(targetFor(data.session.user.email));
  });
} else {
  showFormError('Konfigurasi belum lengkap: isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di public/config.js.');
  submitBtn.disabled = true;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showFormError('');
  if (!sb) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!validate(email, password)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses…';
  try {
    const loginEmail = toLoginEmail(email);
    const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password });
    if (error) {
      showFormError(friendlyError(error));
    } else {
      window.location.href = targetFor(loginEmail);
      return;
    }
  } catch (err) {
    showFormError(friendlyError(err));
  }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Masuk';
});
