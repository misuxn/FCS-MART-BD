const API_BASES = [
  ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? [`${window.location.origin}/api`]
    : []),
  'http://localhost:3000/api',
  'http://127.0.0.1:3000/api',
];

const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginMessage = document.getElementById('login-message');

function setLoginMessage(message, isError = false) {
  if (!loginMessage) {
    return;
  }
  loginMessage.textContent = message;
  loginMessage.classList.toggle('error', isError);
}

async function requestWithFallback(pathname, options = {}) {
  let lastError;

  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${pathname}`, {
        credentials: 'include',
        ...options,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || `Request failed with status ${response.status}`);
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Request failed');
}

async function initialize() {
  try {
    const me = await requestWithFallback('/auth/me');
    if (me.user?.role === 'admin') {
      window.location.href = '/admin.html';
      return;
    }
    if (me.user) {
      window.location.href = '/';
      return;
    }
  } catch {
    // ignore
  }

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = loginEmail?.value.trim();
    const password = loginPassword?.value;

    if (!email || !password) {
      setLoginMessage('Email and password are required.', true);
      return;
    }

    try {
      const data = await requestWithFallback('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      setLoginMessage(data.message || 'Login successful.');
      if (data.user?.role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/';
      }
    } catch (error) {
      setLoginMessage(error.message || 'Login failed.', true);
    }
  });
}

initialize();
