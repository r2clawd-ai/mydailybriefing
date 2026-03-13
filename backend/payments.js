/**
 * payments.js — Stripe subscription integration for My Daily Briefing
 * Plan: $4.99/month, 14-day free trial
 * 
 * Routes added to server.js:
 *   POST /api/checkout          → create Stripe checkout session
 *   POST /api/webhook           → Stripe webhook handler
 *   GET  /api/subscription/:token → check subscription status
 *   POST /api/portal/:token     → create customer portal session
 */

const Stripe = require('stripe');

// Lazy-load stripe to avoid crash if key not set yet
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = Stripe(key);
  }
  return _stripe;
}

const PRICE_ID = process.env.STRIPE_PRICE_ID; // set after creating product in Stripe
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Create a Stripe Checkout session for a user token.
 * Returns { url } to redirect the user to.
 */
async function createCheckoutSession(db, userToken, successUrl, cancelUrl) {
  const stripe = getStripe();
  
  // Get or create Stripe customer
  const user = db.prepare('SELECT * FROM users WHERE token = ?').get(userToken);
  if (!user) throw new Error('User not found');

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { briefing_token: userToken }
    });
    customerId = customer.id;
    db.prepare('UPDATE users SET stripe_customer_id = ? WHERE token = ?')
      .run(customerId, userToken);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price: PRICE_ID,
      quantity: 1,
    }],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: 14,
    },
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
    metadata: { briefing_token: userToken }
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Handle Stripe webhook events.
 * Call this with raw request body (Buffer) and stripe-signature header.
 */
async function handleWebhook(db, rawBody, signature) {
  const stripe = getStripe();
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    throw err;
  }

  const data = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const token = data.metadata?.briefing_token;
      if (token) {
        db.prepare('UPDATE users SET subscription_status = ?, subscription_id = ?, stripe_customer_id = ? WHERE token = ?')
          .run('trialing', data.subscription, data.customer, token);
        console.log(`[stripe] checkout completed for token ${token}`);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const token = getTokenByCustomer(db, data.customer);
      if (token) {
        db.prepare('UPDATE users SET subscription_status = ?, subscription_id = ?, subscription_end = ? WHERE token = ?')
          .run(data.status, data.id, data.current_period_end, token);
        console.log(`[stripe] subscription ${data.status} for token ${token}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const token = getTokenByCustomer(db, data.customer);
      if (token) {
        db.prepare('UPDATE users SET subscription_status = ?, subscription_end = ? WHERE token = ?')
          .run('canceled', data.current_period_end, token);
        console.log(`[stripe] subscription canceled for token ${token}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const token = getTokenByCustomer(db, data.customer);
      if (token) {
        db.prepare('UPDATE users SET subscription_status = ? WHERE token = ?')
          .run('past_due', token);
      }
      break;
    }

    default:
      console.log(`[stripe-webhook] unhandled event: ${event.type}`);
  }

  return { received: true };
}

function getTokenByCustomer(db, customerId) {
  const row = db.prepare('SELECT token FROM users WHERE stripe_customer_id = ?').get(customerId);
  return row?.token || null;
}

/**
 * Get subscription status for a user token.
 * Returns { status, trialEnd, isActive, isPro }
 */
function getSubscriptionStatus(db, userToken) {
  const user = db.prepare('SELECT subscription_status, subscription_end, created_at FROM users WHERE token = ?').get(userToken);
  if (!user) return { status: 'none', isActive: false, isPro: false };

  const status = user.subscription_status || 'none';
  const isActive = ['active', 'trialing'].includes(status);
  const isPro = isActive;

  // Check free trial window (14 days from account creation if no subscription)
  const createdAt = new Date(user.created_at || Date.now()).getTime();
  const freeDaysMs = 14 * 24 * 60 * 60 * 1000;
  const inFreeTrial = !user.subscription_status && Date.now() < createdAt + freeDaysMs;

  return {
    status: inFreeTrial ? 'free_trial' : status,
    isActive: isActive || inFreeTrial,
    isPro,
    trialEnd: inFreeTrial ? new Date(createdAt + freeDaysMs).toISOString() : null,
    subscriptionEnd: user.subscription_end ? new Date(user.subscription_end * 1000).toISOString() : null,
  };
}

/**
 * Create a Stripe customer portal session for managing subscriptions.
 */
async function createPortalSession(db, userToken, returnUrl) {
  const stripe = getStripe();
  const user = db.prepare('SELECT stripe_customer_id FROM users WHERE token = ?').get(userToken);
  if (!user?.stripe_customer_id) throw new Error('No subscription found');

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: returnUrl,
  });

  return { url: session.url };
}

module.exports = {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  createPortalSession,
};
