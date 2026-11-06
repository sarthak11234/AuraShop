# VEXO — GitHub Pages Static Deployment Guide

## 1. Overview & Architecture

VEXO is designed with a hybrid deployment model:
1. **Full-Stack Application** (Vercel / Node.js / Serverless): Leverages Next.js 16, PostgreSQL (Prisma 7), Auth.js, and Server Actions for live checkout, customer accounts, and administrative operations.
2. **Static Showcase (GitHub Pages)**: A standalone, zero-database static export served under `https://vaishuu24.github.io/AuraShop/`.

### Architecture Preservation
- **No Replacement**: The existing full-stack codebase, API routes, Prisma schemas, and migrations are 100% preserved.
- **Clean Segregation**: During the static build (`npm run build:export`), server-only components (`src/app/api`, `src/app/account`, `src/app/admin`, and `src/proxy.ts`) and database cache directives are temporarily isolated by `scripts/build-static-export.js`.
- **Canonical Seed Data**: All static routes, product details, and category listings are rendered directly from `prisma/seed-data.ts`. No mock or synthetic data was created.
- **Asset Normalization**: All image, 3D model, and video assets are post-processed to properly resolve under the repository subpath `/AuraShop/`.
- **GitHub Pages Routing**: Emits `out/.nojekyll` to disable Jekyll processing and enable direct loading of Next.js static asset directories (`_next/`).

---

## 2. Supported and Unsupported Features in Static Mode

| Feature Area | Static Showcase (GitHub Pages) | Full-Stack (Server / Vercel) |
| :--- | :---: | :---: |
| **Editorial Homepage (`/`)** | Supported | Supported |
| **Full Catalogue (`/collections`)** | Supported | Supported |
| **Category Routes (`/collections/[category]`)** | Supported (OUTERWEAR, TECH, ACCESSORY, GEAR, ARTIFACT) | Supported |
| **Product Detail Pages (`/product/[id]`)** | Supported (all 8 primary + 13 edit products) | Supported |
| **Product Image Galleries** | Supported | Supported |
| **3D Fashion Viewer & Avatars** | Supported (WebGL client rendering) | Supported |
| **Video Film Modal** | Supported (`/videos/hero-film.mp4`) | Supported |
| **Client Cart (Zustand)** | Supported (Client demo & LocalStorage) | Supported |
| **Wishlist (Zustand)** | Supported (Client demo & LocalStorage) | Supported |
| **Responsive Design & Animations** | Supported (Tailwind 4 + Framer Motion) | Supported |
| **Auth.js / User Login** | Explicitly Unavailable (Notice in UI) | Supported |
| **Database Persistence (PostgreSQL)** | Disabled (Seed-data only) | Supported |
| **Live Checkout & Payment Gateway** | Disabled (Demo view only) | Supported (Razorpay / COD) |
| **Order Tracking & Account Dashboard** | Unavailable | Supported |
| **Admin Operations & Refunds** | Unavailable | Supported |

---

## 3. Local Build & Test Commands

### Statically Export for GitHub Pages
```bash
npm run build:export
```
This builds the site into the `out/` folder, creates `out/.nojekyll`, and ensures all assets are prefixed with `/AuraShop/`.

### Serve and Test Locally
You can test the generated static build using a simple local HTTP server simulating GitHub Pages subpath:
```bash
npx serve out -p 3000
```
or run the automated verification script:
```bash
node -e "
const { chromium } = require('@playwright/test');
// Run verification against http://localhost:3000/AuraShop/
"
```

### Full-Stack Build (Regular Server Mode)
```bash
npm run build
```

---

## 4. GitHub Repository Configuration for GitHub Pages

To activate deployment on your repository `https://github.com/vaishuu24/AuraShop`:

1. Open repository settings on GitHub:
   `https://github.com/vaishuu24/AuraShop/settings/pages`
2. Under **Build and deployment**:
   - **Source**: Select **GitHub Actions**.
3. Push your changes to the `main` branch or trigger the workflow manually from the **Actions** tab (`Deploy VEXO to GitHub Pages`).
4. Once completed, your showcase will be live at:
   **`https://vaishuu24.github.io/AuraShop/`**

---

## 5. Workflow Details (`.github/workflows/deploy-github-pages.yml`)

- Runs on `ubuntu-latest` with official GitHub Pages actions (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`).
- Minimum required permissions:
  ```yaml
  permissions:
    contents: read
    pages: write
    id-token: write
  ```
- Concurrency group is set to `pages` with `cancel-in-progress: true` to prevent overlapping runs.
- Executes `npm ci` and `npm run build:export` without requiring any secrets or database connections.

---

## 6. Maintenance Guidelines

- When adding new products to `prisma/seed-data.ts`, they are automatically picked up by both the static export and database seeding scripts.
- Do not check in the `out/` directory into Git (it remains in `.gitignore`). GitHub Pages deploys directly from the workflow artifact.
- The dual configuration in `next.config.ts` ensures that neither static builds nor standard full-stack builds conflict.

