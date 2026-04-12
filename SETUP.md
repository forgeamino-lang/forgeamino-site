# Forge Amino — Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Supabase account (free at supabase.com)
- A Resend account (free at resend.com)
- A Vercel account (free at vercel.com)

---

## Step 1: Supabase (Database)

1. Go to supabase.com and create a new project
2. Once created, go to **SQL Editor** and paste the contents of `supabase-schema.sql` — run it
3. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Resend (Email)

1. Go to resend.com and create a free account
2. Add and verify your domain (forgeamino.com) under **Domains**
3. Create an API key → `RESEND_API_KEY`
4. Set the FROM address in `lib/email.js` to `orders@forgeamino.com` (or your verified address)

---

## Step 3: Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
ADMIN_EMAIL=swmrdude15@gmail.com
ADMIN_PASSWORD=choose-a-secure-password
NEXT_PUBLIC_SITE_URL=https://forgeamino.com
```

---

## Step 4: Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should see the shop.

---

## Step 5: Deploy to Vercel

1. Push the project to a GitHub repo
2. Go to vercel.com → New Project → Import from GitHub
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

---

## Step 6: Connect Your Domain

1. In Vercel → Project Settings → Domains → Add `forgeamino.com`
2. Update your DNS records at your domain registrar as Vercel instructs
3. Once DNS propagates (usually minutes), the site is live at forgeamino.com

---

## Admin Panel

Access at: `forgeamino.com/admin`

- Login with your `ADMIN_PASSWORD`
- View all orders, filter by status
- Click any order to open the detail view
- Mark orders as Paid → triggers payment confirmation email to customer
- Enter tracking number + click "Save + Mark Shipped" → triggers shipping email

---

## Adding/Editing Products

Currently products are in `lib/products.js`. To add a product:
1. Add a new entry to the `PRODUCTS` array
2. Upload the product image to Supabase Storage
3. Update the `image` URL in the product entry

---

## Payment Method: Venmo Details

- Handle: `@ForgeA`
- Required note: `"Thank you"`
- These are hardcoded in `lib/email.js` — update there if they ever change

## Adding Zelle / Bank Transfer

When ready to add Zelle or bank transfer as additional payment options:
1. Add the option to the radio buttons in `app/checkout/page.js`
2. Add the payment instructions in the `getPaymentInstructions()` function in `lib/email.js`
