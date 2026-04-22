const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = path.join(__dirname, '..');
const productsPath = path.join(rootDir, 'data', 'products.json');
const newsletterPath = path.join(rootDir, 'data', 'newsletter-emails.json');

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
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

app.get('/api/products', async (_req, res) => {
  const products = await readJson(productsPath, []);
  res.json({ products });
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

  await writeJson(newsletterPath, rows);
  return res.status(201).json({ message: 'Subscribed successfully!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
