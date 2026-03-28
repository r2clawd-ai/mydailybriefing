# Stripe Setup Guide — My Daily Briefing Pro

Everything is built and waiting. You just need to create the Stripe product and paste 3 keys.

## Step 1 — Create Stripe Account
1. Go to https://stripe.com → Create account
2. Use r2clawd@gmail.com or your personal email
3. Complete identity verification (takes ~5 min)

## Step 2 — Create the Product
1. Dashboard → Products → Add product
2. Name: **My Daily Briefing Pro**
3. Pricing: **$7.99/month**, recurring
4. Add a 14-day free trial
5. Save → copy the **Price ID** (`price_...`)

## Step 3 — Get API Keys
1. Dashboard → Developers → API Keys
2. Copy **Secret key** (`sk_live_...`)
   - Use test key (`sk_test_...`) first for testing

## Step 4 — Set Up Webhook
1. Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://mydailybriefing-api-production.up.railway.app/api/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Save → copy **Signing secret** (`whsec_...`)

## Step 5 — Add to Railway
1. Go to Railway dashboard → mydailybriefing-api project
2. Variables tab → Add:
   - `STRIPE_SECRET_KEY` = `sk_live_...`
   - `STRIPE_PRICE_ID` = `price_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
3. Railway auto-redeploys

## Step 6 — Tell R2
Paste the 3 keys in Discord and I'll store them in keychain + verify everything works.

---

## What's Already Built ✅
- `payments.js` — full Stripe checkout, webhook, portal handling
- `server.js` — `/api/checkout`, `/api/webhook`, `/api/portal/:token` routes wired
- `db.js` — `stripe_customer_id`, `subscription_status`, `subscription_id`, `subscription_end` columns added
- `briefing.html` — upgrade modal, paywall overlay, startCheckout(), openPortal() all working
- Pro feature gates in API responses

## Pro Features Gated
- X/Twitter timeline feed
- Newsletter/Substack feeds
- Extended stock tracking (>3 tickers)
- Priority briefing refresh
- Email digest delivery
- Unlimited saved locations

## Pricing Strategy
- Free: core local news + weather + basic markets
- Pro ($7.99/mo): X feed, newsletters, full stock suite, email delivery
- 14-day free trial (no card required — convert on value)
