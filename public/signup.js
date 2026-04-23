const API_BASES = [
  ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? [`${window.location.origin}/api`]
    : []),
  'http://localhost:3000/api',
  'http://127.0.0.1:3000/api',
];

const signupForm = document.getElementById('signup-form');
const signupName = document.getElementById('signup-name');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupConfirmPassword = document.getElementById('signup-confirm-password');
const signupMessage = document.getElementById('signup-message');

function setSignupMessage(message, isError = false) {
  if (!signupMessage) {
    return;
  }
  signupMessage.textContent = message;
  signupMessage.classList.toggle('error', isError);
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

function isValidEmail(email) {
  const value = String(email || '').trim();
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
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

  signupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = signupName?.value.trim();
    const email = signupEmail?.value.trim();
    const password = signupPassword?.value || '';
    const confirmPassword = signupConfirmPassword?.value || '';

    if (!name || !email || !password || !confirmPassword) {
      setSignupMessage('All fields are required.', true);
      return;
    }

    if (!isValidEmail(email)) {
      setSignupMessage('Please enter a valid email address.', true);
      return;
    }

    if (password.length < 6) {
      setSignupMessage('Password must be at least 6 characters long.', true);
      return;
    }

    if (password !== confirmPassword) {
      setSignupMessage('Passwords do not match.', true);
      return;
    }

    try {
      const data = await requestWithFallback('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      setSignupMessage(data.message || 'Account created successfully.');
      if (data.user?.role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/';
      }
    } catch (error) {
      setSignupMessage(error.message || 'Signup failed.', true);
    }
  });
}

initialize();
