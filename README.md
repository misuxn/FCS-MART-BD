# FCS Mart BD

Fashion landing page with API-driven products, newsletter capture, and wishlist support.

## Project Structure

```
.
├── data/
│   ├── newsletter-emails.json
│   └── products.json
├── public/
│   ├── app.js
│   ├── index.html
│   ├── style.css
│   └── assets/
│       ├── images/
│       └── logos/
├── src/
│   └── server.js
├── package.json
└── README.md
```

## Features

- Responsive fashion landing page UI
- Products loaded from backend API (`/api/products`)
- Newsletter email submission with server-side validation (`/api/newsletter`)
- Wishlist/favourite toggle persisted in `localStorage`

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start server:
   ```bash
   npm start
   ```
3. Open:
   - http://localhost:3000

## API Endpoints

- `GET /api/products`
- `POST /api/newsletter`
  - Body: `{ "email": "user@example.com" }`
# FCS-MART-BD
