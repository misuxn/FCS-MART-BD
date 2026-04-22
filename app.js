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

const WISHLIST_KEY = 'fcsmart_wishlist';
const API_BASES = [
  ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? [`${window.location.origin}/api`]
    : []),
  'http://localhost:3000/api',
  'http://127.0.0.1:3000/api',
];
let products = [];
let wishlist = new Set();

function loadWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    wishlist = new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    wishlist = new Set();
  }
}

function persistWishlist() {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify([...wishlist]));
}

function formatPrice(price) {
  if (typeof price !== 'number') {
    return '';
  }
  return `$${price.toFixed(2)}`;
}

async function fetchJsonWithFallback(pathname, options) {
  let lastError;

  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${pathname}`, options);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.message || `Request failed with status ${res.status}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Request failed');
}

async function postJsonWithFallback(pathname, body) {
  let lastError;

  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${pathname}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.message || `Request failed with status ${res.status}`);
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Request failed');
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
      <span class="arrow">→</span>
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

async function loadProducts() {
  if (!newArrivalsGrid || !favouriteGrid) {
    return;
  }

  try {
    const data = await fetchJsonWithFallback('/products');
    products = Array.isArray(data.products) ? data.products : [];
    renderProducts();
  } catch {
    newArrivalsGrid.innerHTML = '<p>Unable to load products right now. Start the API server with npm start.</p>';
    favouriteGrid.innerHTML = '<p>Unable to load products right now. Start the API server with npm start.</p>';
  }
}

function handleWishlistClick(event) {
  const button = event.target.closest('.fav-btn');
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  if (!productId) {
    return;
  }

  if (wishlist.has(productId)) {
    wishlist.delete(productId);
  } else {
    wishlist.add(productId);
  }

  persistWishlist();
  renderProducts();
}

function setNewsletterMessage(message, isError = false) {
  if (!newsletterMessage) {
    return;
  }

  newsletterMessage.textContent = message;
  newsletterMessage.classList.toggle('error', isError);
}

function isValidEmail(email) {
  const value = String(email || '').trim();
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
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
    const res = await postJsonWithFallback('/newsletter', { email });

    setNewsletterMessage(res.message || 'Subscribed successfully!');
    newsletterEmailInput.value = '';
  } catch (error) {
    setNewsletterMessage(error.message || 'Server unavailable. Please try again later.', true);
  }
}

loadWishlist();
loadProducts();

document.addEventListener('click', handleWishlistClick);

if (newsletterForm) {
  newsletterForm.addEventListener('submit', handleNewsletterSubmit);
}
