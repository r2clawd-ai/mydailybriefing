/**
 * referral.js — Referral system for My Daily Briefing
 *
 * Schema additions (run via addColumnIfMissing in db.js):
 *   referral_code  TEXT UNIQUE   — user's personal invite code
 *   referred_by    TEXT          — the code used when this user signed up
 *   referral_count INT DEFAULT 0 — how many referred users have joined
 *
 * Reward: every successful referral grants the referrer 7 free Pro days.
 *
 * Exported helpers:
 *   generateReferralCode(token)      → { code, referral_link }
 *   applyReferral(newToken, code)    → { ok, message }
 *   getReferralStats(token)          → { referral_count, days_earned, referral_link, code }
 *
 * Express routes (registered via registerReferralRoutes(app)):
 *   POST /api/referral/apply
 *   GET  /api/users/:token/referral-stats
 */

const { db: rawDb } = require('./db');

// ─── Schema bootstrap ────────────────────────────────────────────────────────

function addColumnIfMissing(columnSql) {
  try {
    rawDb.exec(`ALTER TABLE users ADD COLUMN ${columnSql}`);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) throw err;
  }
}

// SQLite does not allow adding a UNIQUE column directly via ALTER TABLE.
// Add the column first (no constraint), then ensure a unique index exists.
addColumnIfMissing('referral_code  TEXT');
addColumnIfMissing('referred_by    TEXT');
addColumnIfMissing('referral_count INT DEFAULT 0');

// Unique index for referral_code — idempotent (CREATE INDEX IF NOT EXISTS)
rawDb.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code)
  WHERE referral_code IS NOT NULL
`);

// ─── Constants ───────────────────────────────────────────────────────────────

const REFERRAL_REWARD_DAYS = 7;
const BASE_URL = process.env.APP_BASE_URL || 'https://mydailybriefing.app';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
const CODE_LENGTH = 6;

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Generate a random CODE_LENGTH alphanumeric code. */
function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** Build the shareable referral link from a code. */
function buildReferralLink(code) {
  return `${BASE_URL}/index.html?ref=${code}`;
}

/** Extend a user's Pro access by N days from today (or from their existing expiry). */
function extendProByDays(token, days) {
  const user = rawDb.prepare('SELECT is_pro, pro_expires_at FROM users WHERE token = ?').get(token);
  if (!user) return;

  // Start from whichever is later: today or the existing expiry
  const now = new Date();
  let base = now;

  if (user.pro_expires_at) {
    const existing = new Date(user.pro_expires_at);
    if (existing > now) base = existing;
  }

  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  rawDb.prepare(`
    UPDATE users
    SET is_pro = 1,
        pro_expires_at = ?
    WHERE token = ?
  `).run(newExpiry.toISOString(), token);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Ensure the user has a referral code, generating one if needed.
 * Returns { code, referral_link }
 */
function generateReferralCode(token) {
  const user = rawDb.prepare('SELECT referral_code FROM users WHERE token = ?').get(token);
  if (!user) throw new Error('User not found');

  if (user.referral_code) {
    return { code: user.referral_code, referral_link: buildReferralLink(user.referral_code) };
  }

  // Try up to 10 times to land on a unique code
  let code;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomCode();
    const conflict = rawDb.prepare('SELECT id FROM users WHERE referral_code = ?').get(candidate);
    if (!conflict) { code = candidate; break; }
  }
  if (!code) throw new Error('Could not generate a unique referral code — please retry');

  rawDb.prepare('UPDATE users SET referral_code = ? WHERE token = ?').run(code, token);

  return { code, referral_link: buildReferralLink(code) };
}

/**
 * Apply a referral code for a newly signed-up user.
 * - Marks the new user's `referred_by` field.
 * - Increments the referrer's `referral_count`.
 * - Grants the referrer REFERRAL_REWARD_DAYS free Pro days.
 * Idempotent: a user can only be referred once.
 */
function applyReferral(newToken, code) {
  if (!newToken || !code) throw new Error('newToken and code are required');

  const normalizedCode = String(code).toUpperCase().trim();

  // Look up the new user
  const newUser = rawDb.prepare('SELECT token, referred_by FROM users WHERE token = ?').get(newToken);
  if (!newUser) throw new Error('User not found');

  // Prevent double-application
  if (newUser.referred_by) {
    return { ok: false, message: 'Referral already applied to this account' };
  }

  // Find the referrer by code
  const referrer = rawDb.prepare('SELECT token, referral_count FROM users WHERE referral_code = ?').get(normalizedCode);
  if (!referrer) {
    return { ok: false, message: 'Invalid referral code' };
  }

  // Prevent self-referral
  if (referrer.token === newToken) {
    return { ok: false, message: 'You cannot refer yourself' };
  }

  // Apply in a transaction for consistency
  const applyTx = rawDb.transaction(() => {
    // Mark new user as referred
    rawDb.prepare('UPDATE users SET referred_by = ? WHERE token = ?').run(normalizedCode, newToken);

    // Credit the referrer
    const newCount = (referrer.referral_count || 0) + 1;
    rawDb.prepare('UPDATE users SET referral_count = ? WHERE token = ?').run(newCount, referrer.token);

    // Extend Pro access for referrer
    extendProByDays(referrer.token, REFERRAL_REWARD_DAYS);
  });

  applyTx();

  console.log(`[referral] ${referrer.token} referred ${newToken} with code ${normalizedCode} (+${REFERRAL_REWARD_DAYS} Pro days)`);

  return {
    ok: true,
    message: `Referral applied! Your friend earned ${REFERRAL_REWARD_DAYS} free Pro days.`,
    reward_days: REFERRAL_REWARD_DAYS,
  };
}

/**
 * Return referral statistics for a user.
 * Generates a code on first call if one does not exist yet.
 */
function getReferralStats(token) {
  const user = rawDb.prepare('SELECT referral_code, referral_count FROM users WHERE token = ?').get(token);
  if (!user) throw new Error('User not found');

  // Auto-generate code so the link is always ready
  let { code } = generateReferralCode(token);

  const referral_count = user.referral_count || 0;
  const days_earned = referral_count * REFERRAL_REWARD_DAYS;

  return {
    code,
    referral_count,
    days_earned,
    referral_link: buildReferralLink(code),
    reward_days_per_referral: REFERRAL_REWARD_DAYS,
  };
}

// ─── Express route registration ──────────────────────────────────────────────

/**
 * Register referral routes on an Express app instance.
 * Call this from server.js: registerReferralRoutes(app)
 */
function registerReferralRoutes(app) {
  /**
   * POST /api/referral/apply
   * Body: { token: string, code: string }
   * Applies a referral code for a newly signed-up user.
   */
  app.post('/api/referral/apply', (req, res) => {
    try {
      const { token, code } = req.body || {};
      if (!token || !code) {
        return res.status(400).json({ error: 'token and code are required' });
      }
      const result = applyReferral(token, code);
      if (!result.ok) {
        return res.status(400).json({ error: result.message });
      }
      res.json(result);
    } catch (err) {
      console.error('[referral/apply]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/users/:token/referral-stats
   * Returns the user's referral code, count, days earned, and shareable link.
   */
  app.get('/api/users/:token/referral-stats', (req, res) => {
    try {
      const stats = getReferralStats(req.params.token);
      res.json(stats);
    } catch (err) {
      console.error('[referral-stats]', err.message);
      const status = err.message === 'User not found' ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  console.log('  POST /api/referral/apply');
  console.log('  GET  /api/users/:token/referral-stats');
}

module.exports = {
  generateReferralCode,
  applyReferral,
  getReferralStats,
  registerReferralRoutes,
};
