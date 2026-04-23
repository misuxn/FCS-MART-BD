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

## Deploy

### Vercel

- Import this repository in Vercel.
- Framework preset: Other.
- Root directory: repository root.
- Build command: leave empty.
- Install command: `npm install`
- Output directory: leave empty.
- Start command is not needed because `vercel.json` routes all traffic to `api/index.js`.

### Render (alternative)

- Create a new Web Service from this repository.
- Environment: Node.
- Build command: `npm install`
- Start command: `npm start`

### Important Note

This demo currently stores newsletter emails in `data/newsletter-emails.json`. Some cloud/serverless platforms use read-only file systems, so newsletter writes can fail in production. In that case, connect newsletter storage to a database service.
