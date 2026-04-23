const API_BASES = [
  ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? [`${window.location.origin}/api`]
    : []),
  'http://localhost:3000/api',
  'http://127.0.0.1:3000/api',
];

const accountUserLine = document.getElementById('account-user-line');
const statOrders = document.getElementById('stat-orders');
const statWishlist = document.getElementById('stat-wishlist');
const statCart = document.getElementById('stat-cart');
const statSpent = document.getElementById('stat-spent');
const profileForm = document.getElementById('profile-form');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const passwordForm = document.getElementById('password-form');
const currentPassword = document.getElementById('current-password');
const newPassword = document.getElementById('new-password');
const ordersList = document.getElementById('orders-list');
const wishlistList = document.getElementById('wishlist-list');
const accountLogoutBtn = document.getElementById('account-logout-btn');
const accountMessage = document.getElementById('account-message');

let currentUser = null;
let productsById = new Map();

function formatPrice(price) {
  if (typeof price !== 'number') {
    return '$0.00';
  }
  return `$${price.toFixed(2)}`;
}

function setAccountMessage(message, isError = false) {
  if (!accountMessage) {
    return;
  }
  accountMessage.textContent = message;
  accountMessage.classList.toggle('error', isError);
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

function renderOrders(orders) {
  if (!ordersList) {
    return;
  }

  if (!Array.isArray(orders) || orders.length === 0) {
    ordersList.innerHTML = '<p>No orders yet. Start shopping from the home page.</p>';
    return;
  }

  ordersList.innerHTML = '';
  orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((order) => {
      const paymentMethod = String(order.paymentMethod || 'N/A')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
      const deliveryAddress = order.deliveryAddress
        ? `${order.deliveryAddress.addressLine || ''}, ${order.deliveryAddress.city || ''} ${order.deliveryAddress.postalCode || ''}`.trim().replace(/^,\s*|,\s*$/g, '')
        : 'N/A';

      const item = document.createElement('article');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="order-left">
          <strong>Order #${order.id.slice(0, 8)}</strong>
          <small>${new Date(order.createdAt).toLocaleString()}</small>
          <small>Payment: ${paymentMethod}</small>
          <small>Delivery: ${deliveryAddress}</small>
        </div>
        <div class="order-right">
          <strong>${formatPrice(Number(order.total || 0))}</strong>
          <small>Status: ${order.status || 'pending'}</small>
        </div>
      `;
      ordersList.appendChild(item);
    });
}

function renderWishlist(ids) {
  if (!wishlistList) {
    return;
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    wishlistList.innerHTML = '<p>Your wishlist is empty.</p>';
    return;
  }

  wishlistList.innerHTML = '';
  ids.forEach((id) => {
    const product = productsById.get(id);
    const item = document.createElement('article');
    item.className = 'list-item';
    item.innerHTML = `
      <div>
        <strong>${product?.title || 'Unknown Product'}</strong>
        <small>${product?.category || 'N/A'}</small>
      </div>
      <div>
        <strong>${formatPrice(Number(product?.price || 0))}</strong>
      </div>
    `;
    wishlistList.appendChild(item);
  });
}

async function loadProducts() {
  const payload = await requestWithFallback('/products');
  const products = Array.isArray(payload.products) ? payload.products : [];
  productsById = new Map(products.map((item) => [item.id, item]));
}

async function loadSummary() {
  const payload = await requestWithFallback('/account/summary');
  currentUser = payload.user;

  if (accountUserLine) {
    accountUserLine.textContent = `${currentUser.name} • ${currentUser.email}`;
  }

  if (profileName) {
    profileName.value = currentUser.name || '';
  }

  if (profileEmail) {
    profileEmail.value = currentUser.email || '';
  }

  if (statOrders) {
    statOrders.textContent = String(payload.stats?.orderCount || 0);
  }
  if (statWishlist) {
    statWishlist.textContent = String(payload.stats?.wishlistCount || 0);
  }
  if (statCart) {
    statCart.textContent = String(payload.stats?.cartCount || 0);
  }
  if (statSpent) {
    statSpent.textContent = formatPrice(Number(payload.stats?.totalSpent || 0));
  }
}

async function loadOrders() {
  const payload = await requestWithFallback('/orders');
  renderOrders(payload.orders || []);
}

async function loadWishlist() {
  const payload = await requestWithFallback('/wishlist');
  renderWishlist(payload.wishlist || []);
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  const name = profileName?.value.trim();
  const email = profileEmail?.value.trim();

  if (!name || !email) {
    setAccountMessage('Name and email are required.', true);
    return;
  }

  try {
    const payload = await requestWithFallback('/account/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });

    setAccountMessage(payload.message || 'Profile updated.');
    await loadSummary();
  } catch (error) {
    setAccountMessage(error.message || 'Unable to update profile.', true);
  }
}

async function handlePasswordSubmit(event) {
  event.preventDefault();

  const current = currentPassword?.value || '';
  const next = newPassword?.value || '';

  if (!current || !next) {
    setAccountMessage('Current and new password are required.', true);
    return;
  }

  if (next.length < 6) {
    setAccountMessage('New password must be at least 6 characters long.', true);
    return;
  }

  try {
    const payload = await requestWithFallback('/account/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });

    setAccountMessage(payload.message || 'Password updated.');
    if (passwordForm) {
      passwordForm.reset();
    }
  } catch (error) {
    setAccountMessage(error.message || 'Unable to update password.', true);
  }
}

async function handleLogout() {
  try {
    await requestWithFallback('/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login.html';
  }
}

function bindEvents() {
  profileForm?.addEventListener('submit', handleProfileSubmit);
  passwordForm?.addEventListener('submit', handlePasswordSubmit);
  accountLogoutBtn?.addEventListener('click', handleLogout);
}

async function initialize() {
  bindEvents();

  try {
    await loadProducts();
    await loadSummary();
    await loadOrders();
    await loadWishlist();
  } catch {
    window.location.href = '/login.html';
  }
}

initialize();
