# Stripe Setup — My Daily Briefing

## What's been built
- Full subscription backend (payments.js)
- $4.99/month checkout with 14-day free trial
- Paywall overlay in briefing.html
- Billing portal for customers to manage their sub
- Webhook handler for subscription lifecycle

## To go live (30 minutes)

### 1. Create Stripe account
- Go to stripe.com → sign up with your email
- Complete business verification (name, address, bank account for payouts)

### 2. Create the product
Stripe Dashboard → Products → Add Product
- Name: My Daily Briefing Pro
- Price: $4.99 / month (recurring)
- Trial: 14 days free
- Copy the **Price ID** (starts with `price_...`)

### 3. Set up webhook
Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: https://[YOUR-TUNNEL-URL]/api/webhook
- Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
- Copy the **Webhook signing secret** (starts with `whsec_...`)

### 4. Get API keys
Stripe Dashboard → Developers → API keys
- Copy **Secret key** (starts with `sk_live_...` for prod, `sk_test_...` for test)
- Copy **Publishable key** (starts with `pk_...`)

### 5. Store in environment
Edit ~/Library/LaunchAgents/com.mydailybriefing.backend.plist
Add to EnvironmentVariables:
```xml
<key>STRIPE_SECRET_KEY</key>
<string>sk_live_...</string>
<key>STRIPE_PRICE_ID</key>
<string>price_...</string>
<key>STRIPE_WEBHOOK_SECRET</key>
<string>whsec_...</string>
```

Then: `launchctl unload ~/Library/LaunchAgents/com.mydailybriefing.backend.plist && launchctl load ~/Library/LaunchAgents/com.mydailybriefing.backend.plist`

Or just tell R2 "I have Stripe keys" and paste them — I'll store them and restart.

## Revenue math
- 100 users × $4.99 = $499/mo
- 500 users × $4.99 = $2,495/mo
- 1,000 users × $4.99 = $4,990/mo
