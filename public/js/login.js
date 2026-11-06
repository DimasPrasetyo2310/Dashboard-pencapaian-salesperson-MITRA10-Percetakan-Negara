const CFG = window.APP_CONFIG || {};
const SUPABASE_URL = CFG.SUPABASE_URL;
const SUPABASE_KEY = CFG.SUPABASE_PUBLISHABLE_KEY;
const NEXT_ALLOWED = ['dashboard.html', 'monitoring.html'];
const nextParam = new URLSearchParams(window.location.search).get('next');
const DASHBOARD_URL = NEXT_ALLOWED.indexOf(nextParam) >= 0 ? nextParam : 'dashboard.html';

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
    setFieldError(emailInput, emailError, 'Email wajib diisi.');
    ok = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError(emailInput, emailError, 'Format email tidak valid.');
    ok = false;
  } else {
    setFieldError(emailInput, emailError, '');
  }

  if (!password) {
    setFieldError(passwordInput, passwordError, 'Password wajib diisi.');
    ok = false;
  } else if (password.length < 6) {
    setFieldError(passwordInput, passwordError, 'Password minimal 6 karakter.');
    ok = false;
  } else {
    setFieldError(passwordInput, passwordError, '');
  }
  return ok;
}

function friendlyError(error) {
  const msg = (error && error.message) || '';
  if (/invalid login credentials/i.test(msg)) return 'Email atau password salah.';
  if (/email not confirmed/i.test(msg)) return 'Email belum dikonfirmasi. Cek kotak masuk Anda.';
  if (/failed to fetch|network/i.test(msg)) return 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda.';
  return msg || 'Login gagal. Coba lagi.';
}

// Jika sudah login, langsung ke dashboard.
if (sb) {
  sb.auth.getSession().then(({ data }) => {
    if (data && data.session) window.location.replace(DASHBOARD_URL);
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
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      showFormError(friendlyError(error));
    } else {
      window.location.href = DASHBOARD_URL;
      return;
    }
  } catch (err) {
    showFormError(friendlyError(err));
  }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Masuk';
});
