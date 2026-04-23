const header = document.querySelector('.header');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('primary-nav');

if (header && menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('nav-open');
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('nav-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) {
      header.classList.remove('nav-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

const newArrivalsGrid = document.getElementById('new-arrivals-grid');
const favouriteGrid = document.getElementById('favourite-grid');
const newsletterForm = document.getElementById('newsletter-form');
const newsletterEmailInput = document.getElementById('newsletter-email');
const newsletterMessage = document.getElementById('newsletter-message');
const navAccountLink = document.getElementById('nav-account-link');
const navSignupLink = document.getElementById('nav-signup-link');
const navLoginLink = document.getElementById('nav-login-link');
const navAdminLink = document.getElementById('nav-admin-link');
const cartToggle = document.getElementById('cart-toggle');
const cartModal = document.getElementById('cart-modal');
const cartCloseBtn = document.getElementById('cart-close-btn');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalDisplay = document.getElementById('cart-total');
const cartCountDisplay = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');
const cartMessage = document.getElementById('cart-message');
const checkoutFullNameInput = document.getElementById('checkout-full-name');
const checkoutPhoneInput = document.getElementById('checkout-phone');
const checkoutAddressInput = document.getElementById('checkout-address');
const checkoutCityInput = document.getElementById('checkout-city');
const checkoutPostalInput = document.getElementById('checkout-postal');
const checkoutPaymentMethodInput = document.getElementById('checkout-payment-method');

const API_BASES = [
  ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? [`${window.location.origin}/api`]
    : []),
  'http://localhost:3000/api',
  'http://127.0.0.1:3000/api',
];

let products = [];
let wishlist = new Set();
let cart = [];
let currentUser = null;

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

function formatPrice(price) {
  if (typeof price !== 'number') {
    return '';
  }
  return `$${price.toFixed(2)}`;
}

function setNewsletterMessage(message, isError = false) {
  if (!newsletterMessage) {
    return;
  }

  newsletterMessage.textContent = message;
  newsletterMessage.classList.toggle('error', isError);
}

function setCartMessage(message, isError = false) {
  if (!cartMessage) {
    return;
  }

  cartMessage.textContent = message;
  cartMessage.classList.toggle('error', isError);
  if (!isError) {
    setTimeout(() => {
      cartMessage.textContent = '';
    }, 2000);
  }
}

function isValidEmail(email) {
  const value = String(email || '').trim();
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function renderHeaderUI() {
  if (navAccountLink) {
    navAccountLink.hidden = !currentUser;
  }

  if (navAdminLink) {
    navAdminLink.hidden = !currentUser || currentUser.role !== 'admin';
  }

  if (navLoginLink) {
    navLoginLink.hidden = !!currentUser;
  }

  if (navSignupLink) {
    navSignupLink.hidden = !!currentUser;
  }

  if (cartToggle) {
    cartToggle.hidden = !currentUser;
  }
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'card';

  const isActive = wishlist.has(product.id);

  card.innerHTML = `
    <div class="card-top">
      <img src="${product.image}" alt="${product.title}" />
      <button class="fav-btn ${isActive ? 'is-active' : ''}" type="button" data-product-id="${product.id}" aria-label="Toggle favourite">${isActive ? '♥' : '♡'}</button>
    </div>
    <div class="card-row">
      <div>
        <h3>${product.title}</h3>
        <p class="card-meta">${product.category}</p>
        ${product.price ? `<p class="price">${formatPrice(product.price)}</p>` : ''}
      </div>
      <button class="btn btn-sm add-to-cart-btn" type="button" data-product-id="${product.id}">Add to Cart</button>
    </div>
  `;

  return card;
}

function renderProducts() {
  if (!newArrivalsGrid || !favouriteGrid) {
    return;
  }

  const newArrivals = products.filter((item) => !item.isFeatured);
  const favourites = products.filter((item) => item.isFeatured);

  newArrivalsGrid.innerHTML = '';
  favouriteGrid.innerHTML = '';

  newArrivals.forEach((product) => {
    newArrivalsGrid.appendChild(createProductCard(product));
  });

  favourites.forEach((product) => {
    favouriteGrid.appendChild(createProductCard(product));
  });
}

async function loadCurrentUser() {
  const payload = await requestWithFallback('/auth/me');
  currentUser = payload.user || null;
  renderHeaderUI();
}

async function loadProducts() {
  if (!newArrivalsGrid || !favouriteGrid) {
    return;
  }

  try {
    const data = await requestWithFallback('/products');
    products = Array.isArray(data.products) ? data.products : [];
    renderProducts();
  } catch {
    newArrivalsGrid.innerHTML = '<p>Unable to load products right now. Start the API server with npm start.</p>';
    favouriteGrid.innerHTML = '<p>Unable to load products right now. Start the API server with npm start.</p>';
  }
}

async function loadWishlist() {
  if (!currentUser) {
    wishlist = new Set();
    return;
  }

  try {
    const data = await requestWithFallback('/wishlist');
    wishlist = new Set(Array.isArray(data.wishlist) ? data.wishlist : []);
  } catch {
    wishlist = new Set();
  }
}

async function loadCart() {
  if (!currentUser) {
    cart = [];
    renderCart();
    return;
  }

  try {
    const data = await requestWithFallback('/cart');
    cart = Array.isArray(data.cart) ? data.cart : [];
    renderCart();
  } catch {
    cart = [];
    renderCart();
  }
}

function renderCart() {
  if (!cartItemsContainer) {
    return;
  }

  cartItemsContainer.innerHTML = '';

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p style="padding: 1rem; text-align: center;">Your cart is empty</p>';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;

  let total = 0;
  cart.forEach((item) => {
    total += item.subtotal;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'cart-item';
    itemDiv.innerHTML = `
      <div class="cart-item-info">
        <h4>${item.title}</h4>
        <p>${item.quantity} x ${formatPrice(item.price)} = <strong>${formatPrice(item.subtotal)}</strong></p>
      </div>
      <button class="btn btn-sm remove-cart-item-btn" type="button" data-product-id="${item.productId}">Remove</button>
    `;
    cartItemsContainer.appendChild(itemDiv);
  });

  if (cartTotalDisplay) {
    cartTotalDisplay.textContent = formatPrice(total);
  }

  if (cartCountDisplay) {
    cartCountDisplay.textContent = cart.length;
  }
}

function openCart() {
  if (cartModal) {
    cartModal.hidden = false;
  }
}

function closeCart() {
  if (cartModal) {
    cartModal.hidden = true;
  }
}

async function handleWishlistClick(event) {
  const button = event.target.closest('.fav-btn');
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  if (!productId) {
    return;
  }

  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const data = await requestWithFallback('/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    wishlist = new Set(Array.isArray(data.wishlist) ? data.wishlist : []);
    renderProducts();
  } catch {
    window.location.href = '/login.html';
  }
}

async function handleAddToCart(event) {
  const button = event.target.closest('.add-to-cart-btn');
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  if (!productId) {
    return;
  }

  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  try {
    await requestWithFallback('/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    await loadCart();
    setCartMessage('Added to cart!');
  } catch (error) {
    setCartMessage(error.message || 'Unable to add to cart', true);
  }
}

async function handleRemoveFromCart(event) {
  const button = event.target.closest('.remove-cart-item-btn');
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  if (!productId) {
    return;
  }

  try {
    await requestWithFallback(`/cart/${productId}`, {
      method: 'DELETE',
    });
    await loadCart();
    setCartMessage('Removed from cart');
  } catch (error) {
    setCartMessage(error.message || 'Unable to remove from cart', true);
  }
}

async function handleCheckout() {
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  if (cart.length === 0) {
    setCartMessage('Cart is empty', true);
    return;
  }

  const deliveryAddress = {
    fullName: checkoutFullNameInput?.value.trim() || '',
    phone: checkoutPhoneInput?.value.trim() || '',
    addressLine: checkoutAddressInput?.value.trim() || '',
    city: checkoutCityInput?.value.trim() || '',
    postalCode: checkoutPostalInput?.value.trim() || '',
  };
  const paymentMethod = checkoutPaymentMethodInput?.value || '';

  if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.addressLine || !deliveryAddress.city || !deliveryAddress.postalCode) {
    setCartMessage('Please fill in complete delivery address details.', true);
    return;
  }

  if (!paymentMethod) {
    setCartMessage('Please select a payment method.', true);
    return;
  }

  try {
    await requestWithFallback('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliveryAddress,
        paymentMethod,
      }),
    });

    setCartMessage('Order placed successfully! 🎉');
    if (checkoutFullNameInput) checkoutFullNameInput.value = '';
    if (checkoutPhoneInput) checkoutPhoneInput.value = '';
    if (checkoutAddressInput) checkoutAddressInput.value = '';
    if (checkoutCityInput) checkoutCityInput.value = '';
    if (checkoutPostalInput) checkoutPostalInput.value = '';
    if (checkoutPaymentMethodInput) checkoutPaymentMethodInput.value = '';
    await loadCart();
    setTimeout(() => {
      closeCart();
    }, 2000);
  } catch (error) {
    setCartMessage(error.message || 'Unable to place order', true);
  }
}

async function handleNewsletterSubmit(event) {
  event.preventDefault();

  if (!newsletterEmailInput) {
    return;
  }

  const email = newsletterEmailInput.value.trim();

  if (!email) {
    setNewsletterMessage('Email is required.', true);
    return;
  }

  if (!isValidEmail(email)) {
    setNewsletterMessage('Please enter a valid email address.', true);
    return;
  }

  try {
    const res = await requestWithFallback('/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setNewsletterMessage(res.message || 'Subscribed successfully!');
    newsletterEmailInput.value = '';
  } catch (error) {
    setNewsletterMessage(error.message || 'Server unavailable. Please try again later.', true);
  }
}

function bindEvents() {
  document.addEventListener('click', handleWishlistClick);
  document.addEventListener('click', handleAddToCart);
  document.addEventListener('click', handleRemoveFromCart);

  if (cartToggle) {
    cartToggle.addEventListener('click', openCart);
  }

  if (cartCloseBtn) {
    cartCloseBtn.addEventListener('click', closeCart);
  }

  if (cartModal) {
    cartModal.addEventListener('click', (event) => {
      if (event.target === cartModal) {
        closeCart();
      }
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', handleNewsletterSubmit);
  }
}

async function initialize() {
  bindEvents();
  await loadCurrentUser();
  await loadProducts();
  await loadWishlist();
  await loadCart();
  renderProducts();
}

initialize();
