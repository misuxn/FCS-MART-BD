const API_BASES = [
  ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? [`${window.location.origin}/api`]
    : []),
  'http://localhost:3000/api',
  'http://127.0.0.1:3000/api',
];

const adminUserName = document.getElementById('admin-user-name');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const productForm = document.getElementById('product-form');
const productTitleInput = document.getElementById('product-title');
const productImageInput = document.getElementById('product-image');
const productCategoryInput = document.getElementById('product-category');
const productPriceInput = document.getElementById('product-price');
const productFeaturedInput = document.getElementById('product-featured');
const productSubmitBtn = document.getElementById('product-submit-btn');
const productCancelBtn = document.getElementById('product-cancel-btn');
const adminMessage = document.getElementById('admin-message');
const adminProductsList = document.getElementById('admin-products-list');
const adminOrdersList = document.getElementById('admin-orders-list');
const adminOrderFilters = document.getElementById('admin-order-filters');
const adminPage = document.body?.dataset.adminPage || 'products';

let products = [];
let orders = [];
let editingProductId = null;
let activeOrderStatusFilter = 'all';

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

function setAdminMessage(message, isError = false) {
  if (!adminMessage) {
    return;
  }

  adminMessage.textContent = message;
  adminMessage.classList.toggle('error', isError);
}

function resetProductForm() {
  editingProductId = null;
  productForm?.reset();
  if (productSubmitBtn) {
    productSubmitBtn.textContent = 'Add Product';
  }
  if (productCancelBtn) {
    productCancelBtn.hidden = true;
  }
}

function renderProducts() {
  if (!adminProductsList) {
    return;
  }

  adminProductsList.innerHTML = '';

  if (!products.length) {
    adminProductsList.innerHTML = '<p>No products found.</p>';
    return;
  }

  products.forEach((product) => {
    const row = document.createElement('div');
    row.className = 'admin-item';
    row.innerHTML = `
      <div>
        <strong>${product.title}</strong>
        <p>${product.category} ${typeof product.price === 'number' ? `• ${formatPrice(product.price)}` : ''}</p>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="btn" data-edit-id="${product.id}">Edit</button>
        <button type="button" class="btn btn-dark" data-delete-id="${product.id}">Delete</button>
      </div>
    `;
    adminProductsList.appendChild(row);
  });
}

function formatOrderStatus(status) {
  const value = String(status || '').trim();
  if (!value) {
    return 'Pending';
  }
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPaymentMethod(method) {
  const value = String(method || '').trim();
  if (!value) {
    return 'N/A';
  }
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderOrders() {
  if (!adminOrdersList) {
    return;
  }

  adminOrdersList.innerHTML = '';

  const visibleOrders = activeOrderStatusFilter === 'all'
    ? orders
    : orders.filter((order) => String(order.status || '').toLowerCase() === activeOrderStatusFilter);

  if (!visibleOrders.length) {
    adminOrdersList.innerHTML = '<p>No orders found.</p>';
    return;
  }

  visibleOrders.forEach((order) => {
    const row = document.createElement('div');
    row.className = 'admin-item';

    const delivery = order.deliveryAddress
      ? `${order.deliveryAddress.addressLine || ''}, ${order.deliveryAddress.city || ''} ${order.deliveryAddress.postalCode || ''}`.trim().replace(/^,\s*|,\s*$/g, '')
      : 'N/A';
    const customer = order.user ? `${order.user.name} (${order.user.email})` : order.userId;

    row.innerHTML = `
      <div class="order-meta">
        <strong>Order #${String(order.id || '').slice(0, 8)} • ${formatPrice(Number(order.total || 0))}</strong>
        <p>Customer: ${customer}</p>
        <p>Payment: ${formatPaymentMethod(order.paymentMethod)}</p>
        <p>Delivery: ${delivery}</p>
        <p>Placed: ${new Date(order.createdAt).toLocaleString()}</p>
      </div>
      <div class="admin-row-actions">
        <select class="status-select" data-order-id="${order.id}">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
          <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
        <button type="button" class="btn btn-dark" data-update-order-id="${order.id}">Update</button>
      </div>
    `;

    adminOrdersList.appendChild(row);
  });
}

function renderOrderFilters() {
  if (!adminOrderFilters) {
    return;
  }

  const buttons = adminOrderFilters.querySelectorAll('[data-status-filter]');
  buttons.forEach((button) => {
    const isActive = button.dataset.statusFilter === activeOrderStatusFilter;
    button.classList.toggle('is-active', isActive);
  });
}

async function loadProducts() {
  const payload = await requestWithFallback('/admin/products');
  products = Array.isArray(payload.products) ? payload.products : [];
  renderProducts();
}

async function loadOrders() {
  const payload = await requestWithFallback('/admin/orders');
  orders = Array.isArray(payload.orders) ? payload.orders : [];
  renderOrders();
}

async function loadCurrentUser() {
  try {
    const payload = await requestWithFallback('/auth/me');
    const user = payload.user;

    if (!user) {
      window.location.href = '/#auth-section';
      return;
    }

    if (user.role !== 'admin') {
      window.location.href = '/';
      return;
    }

    if (adminUserName) {
      adminUserName.textContent = `${user.name} (${user.role})`;
    }
  } catch {
    window.location.href = '/#auth-section';
  }
}

async function removeProduct(productId) {
  try {
    const payload = await requestWithFallback(`/admin/products/${productId}`, { method: 'DELETE' });
    setAdminMessage(payload.message || 'Product removed.');
    await loadProducts();
  } catch (error) {
    setAdminMessage(error.message || 'Unable to remove product.', true);
  }
}

async function handleProductSubmit(event) {
  event.preventDefault();

  const payload = {
    title: productTitleInput.value.trim(),
    image: productImageInput.value.trim(),
    category: productCategoryInput.value.trim(),
    price: productPriceInput.value === '' ? null : Number(productPriceInput.value),
    isFeatured: productFeaturedInput.checked,
  };

  if (!payload.title || !payload.image || !payload.category) {
    setAdminMessage('Title, image and category are required.', true);
    return;
  }

  try {
    let response;
    if (editingProductId) {
      response = await requestWithFallback(`/admin/products/${editingProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      response = await requestWithFallback('/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setAdminMessage(response.message || 'Saved.');
    resetProductForm();
    await loadProducts();
  } catch (error) {
    setAdminMessage(error.message || 'Unable to save product.', true);
  }
}

function handleProductsListClick(event) {
  const editButton = event.target.closest('[data-edit-id]');
  const deleteButton = event.target.closest('[data-delete-id]');

  if (editButton) {
    const productId = editButton.dataset.editId;
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    editingProductId = product.id;
    productTitleInput.value = product.title;
    productImageInput.value = product.image;
    productCategoryInput.value = product.category;
    productPriceInput.value = typeof product.price === 'number' ? product.price : '';
    productFeaturedInput.checked = Boolean(product.isFeatured);
    productSubmitBtn.textContent = 'Update Product';
    productCancelBtn.hidden = false;
    return;
  }

  if (deleteButton) {
    const productId = deleteButton.dataset.deleteId;
    removeProduct(productId);
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const payload = await requestWithFallback(`/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setAdminMessage(payload.message || 'Order status updated.');
    await loadOrders();
  } catch (error) {
    setAdminMessage(error.message || 'Unable to update order status.', true);
  }
}

function handleOrdersListClick(event) {
  const filterButton = event.target.closest('[data-status-filter]');
  if (filterButton && adminOrderFilters?.contains(filterButton)) {
    activeOrderStatusFilter = String(filterButton.dataset.statusFilter || 'all');
    renderOrderFilters();
    renderOrders();
    return;
  }

  const updateButton = event.target.closest('[data-update-order-id]');
  if (!updateButton) {
    return;
  }

  const orderId = updateButton.dataset.updateOrderId;
  const select = adminOrdersList?.querySelector(`select[data-order-id="${orderId}"]`);
  const status = select?.value;

  if (!orderId || !status) {
    setAdminMessage('Please choose a valid order status.', true);
    return;
  }

  updateOrderStatus(orderId, status);
}

async function handleLogout() {
  await requestWithFallback('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function bindEvents() {
  productForm?.addEventListener('submit', handleProductSubmit);
  adminProductsList?.addEventListener('click', handleProductsListClick);
  adminOrdersList?.addEventListener('click', handleOrdersListClick);
  adminOrderFilters?.addEventListener('click', handleOrdersListClick);
  productCancelBtn?.addEventListener('click', resetProductForm);
  adminLogoutBtn?.addEventListener('click', handleLogout);
}

async function initialize() {
  bindEvents();
  await loadCurrentUser();

  if (adminPage === 'orders') {
    renderOrderFilters();
    await loadOrders();
    return;
  }

  await loadProducts();
}

initialize();
