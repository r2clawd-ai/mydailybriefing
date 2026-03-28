/**
 * stripe.js — Stripe subscription integration for My Daily Briefing
 *
 * Exposes:
 *   createCheckoutSession(userToken, priceId)  → { url, sessionId }
 *   handleWebhook(rawBody, sig)                → { received: true }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      — TODO: Steven, drop your Stripe secret key here
 *   STRIPE_WEBHOOK_SECRET  — TODO: Steven, drop your webhook signing secret here
 *                            (Stripe Dashboard → Developers → Webhooks → signing secret)
 *
 * Default price: $9/month Pro subscription
 *   STRIPE_PRICE_ID        — TODO: Steven, create a recurring $9/mo price in Stripe
 *                            and paste the price_XXXX id here (or set env var)
 */

'use strict';

const Stripe = require('stripe');
const db     = require('./db');

// ── Lazy Stripe client ────────────────────────────────────────────────────────

let _stripe = null;
function getStripe() {
  if (!_stripe) {
    // TODO: Steven — set STRIPE_SECRET_KEY in your Railway / .env file
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = Stripe(key);
  }
  return _stripe;
}

// TODO: Steven — after creating a $9/mo product in Stripe Dashboard,
//       set STRIPE_PRICE_ID env var (e.g. price_1AbcXXXXXXXXXXXX)
const DEFAULT_PRICE_ID = process.env.STRIPE_PRICE_ID;

// TODO: Steven — set STRIPE_WEBHOOK_SECRET from Stripe Dashboard
//       Developers → Webhooks → your endpoint → Signing secret
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setUserPro(token, isPro) {
  db.updateUser(token, {
    is_pro:        isPro,
    pro_expires_at: isPro ? null : new Date().toISOString(),
  });
}

function getTokenByCustomer(customerId) {
  const row = db.db
    .prepare('SELECT token FROM users WHERE stripe_customer_id = ?')
    .get(customerId);
  return row?.token || null;
}

// ── createCheckoutSession ─────────────────────────────────────────────────────

/**
 * Create a Stripe-hosted checkout session for a Pro subscription.
 *
 * @param {string} userToken  - the briefing app user token
 * @param {string} [priceId]  - Stripe price ID; falls back to STRIPE_PRICE_ID env var
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
async function createCheckoutSession(userToken, priceId) {
  const stripe  = getStripe();
  const resolvedPriceId = priceId || DEFAULT_PRICE_ID;

  if (!resolvedPriceId) {
    throw new Error(
      'No Stripe price ID supplied. Set STRIPE_PRICE_ID env var or pass priceId.'
    );
  }

  // Look up user
  const user = db.getUserByToken(userToken);
  if (!user) throw new Error('User not found');

  // Get or create Stripe customer
  let customerId = db.db
    .prepare('SELECT stripe_customer_id FROM users WHERE token = ?')
    .get(userToken)?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email || undefined,
      metadata: { briefing_token: userToken },
    });
    customerId = customer.id;
    db.db
      .prepare('UPDATE users SET stripe_customer_id = ? WHERE token = ?')
      .run(customerId, userToken);
  }

  // Build success / cancel URLs
  const base = process.env.APP_BASE_URL || 'https://mydailybriefing.app';
  const successUrl = `${base}/upgrade.html?token=${userToken}&upgraded=1`;
  const cancelUrl  = `${base}/upgrade.html?token=${userToken}&cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    payment_method_types: ['card'],
    line_items: [{
      price:    resolvedPriceId,
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: successUrl + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:  cancelUrl,
    metadata: { briefing_token: userToken },
  });

  return { url: session.url, sessionId: session.id };
}

// ── handleWebhook ─────────────────────────────────────────────────────────────

/**
 * Verify and process a Stripe webhook event.
 * Must be called with the raw request body (Buffer) and stripe-signature header.
 *
 * Handled events:
 *   checkout.session.completed     → sets is_pro = true
 *   customer.subscription.deleted  → sets is_pro = false
 *   customer.subscription.updated  → syncs is_pro to subscription status
 *   invoice.payment_failed         → marks subscription_status = past_due
 *
 * @param {Buffer}  rawBody  - raw request body (do NOT parse as JSON first)
 * @param {string}  sig      - value of the stripe-signature header
 * @returns {Promise<{ received: boolean }>}
 */
async function handleWebhook(rawBody, sig) {
  const stripe = getStripe();

  if (!WEBHOOK_SECRET) {
    // TODO: Steven — STRIPE_WEBHOOK_SECRET is not set; webhook signatures cannot be verified
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    throw err;
  }

  const obj = event.data.object;
  console.log(`[stripe-webhook] event: ${event.type}`);

  switch (event.type) {

    case 'checkout.session.completed': {
      const token = obj.metadata?.briefing_token;
      if (token) {
        // Mark user as Pro immediately upon successful checkout
        setUserPro(token, true);
        db.db
          .prepare('UPDATE users SET subscription_status = ?, subscription_id = ?, stripe_customer_id = ? WHERE token = ?')
          .run('active', obj.subscription, obj.customer, token);
        console.log(`[stripe] checkout.session.completed → is_pro=true for token ${token}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const token = getTokenByCustomer(obj.customer);
      if (token) {
        const isActive = ['active', 'trialing'].includes(obj.status);
        setUserPro(token, isActive);
        db.db
          .prepare('UPDATE users SET subscription_status = ?, subscription_id = ?, subscription_end = ? WHERE token = ?')
          .run(obj.status, obj.id, obj.current_period_end, token);
        console.log(`[stripe] subscription.updated → status=${obj.status}, is_pro=${isActive} for token ${token}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const token = getTokenByCustomer(obj.customer);
      if (token) {
        // Subscription cancelled — revoke Pro access
        setUserPro(token, false);
        db.db
          .prepare('UPDATE users SET subscription_status = ?, subscription_end = ? WHERE token = ?')
          .run('canceled', obj.current_period_end, token);
        console.log(`[stripe] subscription.deleted → is_pro=false for token ${token}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const token = getTokenByCustomer(obj.customer);
      if (token) {
        db.db
          .prepare('UPDATE users SET subscription_status = ? WHERE token = ?')
          .run('past_due', token);
        console.log(`[stripe] invoice.payment_failed → past_due for token ${token}`);
      }
      break;
    }

    default:
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
  }

  return { received: true };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { createCheckoutSession, handleWebhook };
