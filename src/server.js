const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const isServerless = !!process.env.VERCEL;
const rootDir = path.join(__dirname, '..');
const productsPath = path.join(rootDir, 'data', 'products.json');
const newsletterPath = path.join(rootDir, 'data', 'newsletter-emails.json');
const usersPath = path.join(rootDir, 'data', 'users.json');
const wishlistsPath = path.join(rootDir, 'data', 'wishlists.json');
const cartsPath = path.join(rootDir, 'data', 'carts.json');
const ordersPath = path.join(rootDir, 'data', 'orders.json');

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use('/admin.html', requireAdminPage);
app.use('/order-manager.html', requireAdminPage);
app.use('/account.html', requireUserPage);
app.use(express.static(path.join(rootDir, 'public')));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  return next();
}

function requireAdminPage(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  if (req.session.role !== 'admin') {
    return res.redirect('/');
  }
  return next();
}

function requireUserPage(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  return next();
}

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  const users = await readJson(usersPath, []);
  const user = users.find((item) => item.id === req.session.userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }

  return res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const users = await readJson(usersPath, []);
  const exists = users.some((item) => item.email === email);

  if (exists) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const role = users.length === 0 ? 'admin' : 'user';
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    role,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeJson(usersPath, users);

  req.session.userId = user.id;
  req.session.role = user.role;

  return res.status(201).json({ message: 'Account created successfully.', user: sanitizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const users = await readJson(usersPath, []);
  const user = users.find((item) => item.email === email);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;

  return res.json({ message: 'Login successful.', user: sanitizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/account/summary', requireAuth, async (req, res) => {
  const users = await readJson(usersPath, []);
  const user = users.find((item) => item.id === req.session.userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const orders = await readJson(ordersPath, []);
  const userOrders = orders.filter((item) => item.userId === user.id);
  const orderCount = userOrders.length;
  const totalSpent = userOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  const wishlists = await readJson(wishlistsPath, {});
  const wishlist = Array.isArray(wishlists[user.id]) ? wishlists[user.id] : [];

  const carts = await readJson(cartsPath, {});
  const cart = Array.isArray(carts[user.id]) ? carts[user.id] : [];

  return res.json({
    user: sanitizeUser(user),
    stats: {
      orderCount,
      wishlistCount: wishlist.length,
      cartCount: cart.length,
      totalSpent: Number(totalSpent.toFixed(2)),
    },
  });
});

app.put('/api/account/profile', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required.' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const users = await readJson(usersPath, []);
  const userIndex = users.findIndex((item) => item.id === req.session.userId);

  if (userIndex === -1) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const emailExists = users.some((item) => item.email === email && item.id !== req.session.userId);
  if (emailExists) {
    return res.status(409).json({ message: 'Email already in use by another account.' });
  }

  users[userIndex] = {
    ...users[userIndex],
    name,
    email,
  };

  await writeJson(usersPath, users);
  return res.json({ message: 'Profile updated successfully.', user: sanitizeUser(users[userIndex]) });
});

app.put('/api/account/password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  const users = await readJson(usersPath, []);
  const userIndex = users.findIndex((item) => item.id === req.session.userId);

  if (userIndex === -1) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const user = users[userIndex];
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  users[userIndex] = {
    ...user,
    passwordHash,
  };

  await writeJson(usersPath, users);
  return res.json({ message: 'Password updated successfully.' });
});

app.get('/api/products', async (_req, res) => {
  const products = await readJson(productsPath, []);
  res.json({ products });
});

app.get('/api/wishlist', requireAuth, async (req, res) => {
  const wishlists = await readJson(wishlistsPath, {});
  const wishlist = Array.isArray(wishlists[req.session.userId]) ? wishlists[req.session.userId] : [];
  return res.json({ wishlist });
});

app.post('/api/wishlist/toggle', requireAuth, async (req, res) => {
  const productId = String(req.body?.productId || '').trim();
  if (!productId) {
    return res.status(400).json({ message: 'productId is required.' });
  }

  const products = await readJson(productsPath, []);
  const exists = products.some((item) => item.id === productId);
  if (!exists) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const wishlists = await readJson(wishlistsPath, {});
  const current = Array.isArray(wishlists[req.session.userId]) ? wishlists[req.session.userId] : [];
  const isFav = current.includes(productId);
  const updated = isFav ? current.filter((id) => id !== productId) : [...current, productId];

  wishlists[req.session.userId] = updated;
  await writeJson(wishlistsPath, wishlists);

  return res.json({ message: isFav ? 'Removed from wishlist.' : 'Added to wishlist.', wishlist: updated });
});

app.get('/api/admin/products', requireAuth, requireAdmin, async (_req, res) => {
  const products = await readJson(productsPath, []);
  return res.json({ products });
});

app.post('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const image = String(req.body?.image || '').trim();
  const category = String(req.body?.category || '').trim();
  const rawPrice = Number(req.body?.price);
  const isFeatured = Boolean(req.body?.isFeatured);

  if (!title || !image || !category) {
    return res.status(400).json({ message: 'Title, image and category are required.' });
  }

  const product = {
    id: crypto.randomUUID(),
    title,
    image,
    category,
    price: Number.isFinite(rawPrice) ? rawPrice : undefined,
    isFeatured,
  };

  const products = await readJson(productsPath, []);
  products.push(product);
  await writeJson(productsPath, products);
  return res.status(201).json({ message: 'Product added successfully.', product });
});

app.put('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const productId = String(req.params.id || '').trim();
  const title = String(req.body?.title || '').trim();
  const image = String(req.body?.image || '').trim();
  const category = String(req.body?.category || '').trim();
  const rawPrice = Number(req.body?.price);
  const isFeatured = Boolean(req.body?.isFeatured);

  const products = await readJson(productsPath, []);
  const productIndex = products.findIndex((item) => item.id === productId);

  if (productIndex === -1) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  if (!title || !image || !category) {
    return res.status(400).json({ message: 'Title, image and category are required.' });
  }

  products[productIndex] = {
    ...products[productIndex],
    title,
    image,
    category,
    price: Number.isFinite(rawPrice) ? rawPrice : undefined,
    isFeatured,
  };

  await writeJson(productsPath, products);
  return res.json({ message: 'Product updated successfully.', product: products[productIndex] });
});

app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const productId = String(req.params.id || '').trim();

  const products = await readJson(productsPath, []);
  const filtered = products.filter((item) => item.id !== productId);

  if (filtered.length === products.length) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  await writeJson(productsPath, filtered);

  const wishlists = await readJson(wishlistsPath, {});
  Object.keys(wishlists).forEach((userId) => {
    const list = Array.isArray(wishlists[userId]) ? wishlists[userId] : [];
    wishlists[userId] = list.filter((item) => item !== productId);
  });
  await writeJson(wishlistsPath, wishlists);

  return res.json({ message: 'Product removed successfully.' });
});

// Cart APIs
app.get('/api/cart', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const carts = await readJson(cartsPath, {});
  const cart = carts[userId] || [];
  const products = await readJson(productsPath, []);

  const cartWithDetails = cart.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      quantity: item.quantity,
      title: product?.title || 'Unknown',
      price: product?.price || 0,
      subtotal: (product?.price || 0) * item.quantity,
    };
  });

  const total = cartWithDetails.reduce((sum, item) => sum + item.subtotal, 0);
  return res.json({ cart: cartWithDetails, total: parseFloat(total.toFixed(2)) });
});

app.post('/api/cart', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const productId = String(req.body?.productId || '').trim();
  const quantity = Math.max(1, Number(req.body?.quantity || 1));
  const products = await readJson(productsPath, []);

  if (!products.find((p) => p.id === productId)) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const carts = await readJson(cartsPath, {});
  if (!carts[userId]) {
    carts[userId] = [];
  }

  const existingItem = carts[userId].find((item) => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    carts[userId].push({ productId, quantity });
  }

  await writeJson(cartsPath, carts);
  return res.json({ message: 'Added to cart.', cart: carts[userId] });
});

app.delete('/api/cart/:productId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const productId = String(req.params.productId || '').trim();

  const carts = await readJson(cartsPath, {});
  if (carts[userId]) {
    carts[userId] = carts[userId].filter((item) => item.productId !== productId);
  }

  await writeJson(cartsPath, carts);
  return res.json({ message: 'Removed from cart.' });
});

app.post('/api/cart/clear', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const carts = await readJson(cartsPath, {});
  carts[userId] = [];
  await writeJson(cartsPath, carts);
  return res.json({ message: 'Cart cleared.' });
});

// Orders APIs
app.get('/api/orders', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const orders = await readJson(ordersPath, []);
  const userOrders = orders.filter((order) => order.userId === userId);
  return res.json({ orders: userOrders });
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const deliveryAddress = {
    fullName: String(req.body?.deliveryAddress?.fullName || '').trim(),
    phone: String(req.body?.deliveryAddress?.phone || '').trim(),
    addressLine: String(req.body?.deliveryAddress?.addressLine || '').trim(),
    city: String(req.body?.deliveryAddress?.city || '').trim(),
    postalCode: String(req.body?.deliveryAddress?.postalCode || '').trim(),
  };
  const paymentMethod = String(req.body?.paymentMethod || '').trim();

  if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.addressLine || !deliveryAddress.city || !deliveryAddress.postalCode) {
    return res.status(400).json({ message: 'Complete delivery address is required.' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ message: 'Payment method is required.' });
  }

  const carts = await readJson(cartsPath, {});
  const cart = carts[userId] || [];

  if (cart.length === 0) {
    return res.status(400).json({ message: 'Cart is empty.' });
  }

  const products = await readJson(productsPath, []);
  const orderItems = cart.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      title: product?.title || 'Unknown',
      price: product?.price || 0,
      quantity: item.quantity,
      subtotal: (product?.price || 0) * item.quantity,
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const order = {
    id: crypto.randomUUID(),
    userId,
    items: orderItems,
    total: parseFloat(total.toFixed(2)),
    deliveryAddress,
    paymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const orders = await readJson(ordersPath, []);
  orders.push(order);
  await writeJson(ordersPath, orders);

  carts[userId] = [];
  await writeJson(cartsPath, carts);

  return res.status(201).json({ message: 'Order placed successfully.', order });
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (_req, res) => {
  const orders = await readJson(ordersPath, []);
  const users = await readJson(usersPath, []);
  const usersById = new Map(users.map((user) => [user.id, user]));

  const mapped = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((order) => {
      const user = usersById.get(order.userId);
      return {
        ...order,
        user: user ? sanitizeUser(user) : null,
      };
    });

  return res.json({ orders: mapped });
});

app.put('/api/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const orderId = String(req.params.id || '').trim();
  const status = String(req.body?.status || '').trim().toLowerCase();
  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  const orders = await readJson(ordersPath, []);
  const orderIndex = orders.findIndex((item) => item.id === orderId);

  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  orders[orderIndex] = {
    ...orders[orderIndex],
    status,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(ordersPath, orders);
  return res.json({ message: 'Order status updated successfully.', order: orders[orderIndex] });
});

app.post('/api/newsletter', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const rows = await readJson(newsletterPath, []);
  const exists = rows.some((row) => row.email === email);

  if (exists) {
    return res.status(409).json({ message: 'This email is already subscribed.' });
  }

  rows.push({
    email,
    createdAt: new Date().toISOString(),
  });

  try {
    await writeJson(newsletterPath, rows);
  } catch {
    return res.status(503).json({ message: 'Storage is not writable in this deployment. Use a database service.' });
  }

  return res.status(201).json({ message: 'Subscribed successfully!' });
});

if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
