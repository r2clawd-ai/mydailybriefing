/**
 * email-digest.js
 * Daily email digest module for mydailybriefing.app
 *
 * Exports a single sendDailyDigest() async function that:
 *   1. Fetches every user with an email address from the DB
 *   2. Generates a personalised briefing for each user (re-using the same
 *      logic as GET /api/users/:token/briefing)
 *   3. Sends a styled HTML email via the Resend REST API
 *   4. Rate-limits to 1 email/second to stay within Resend's limits
 *   5. Logs success / failure per user and returns aggregate counts
 *
 * Required env vars:
 *   RESEND_API_KEY  — Resend API key (https://resend.com)
 *
 * Optional env vars:
 *   DIGEST_FROM_EMAIL  — "From" address (default: briefing@mydailybriefing.app)
 *   DIGEST_FROM_NAME   — "From" display name (default: mydailybriefing.app)
 */

'use strict';

const fetch  = require('node-fetch');
const { db: rawDb, getUserByToken } = require('./db');
const { resolveZip }          = require('./geo');
const content                 = require('./content');
const { getLocalAccounts }    = require('./geo-accounts');
const { getHyperLocal }       = require('./hyper-local');
const { getPolitics }         = require('./politics');
const { getHSSports }         = require('./hs-sports');
const { getCommunity }        = require('./community');
const { getSocialFeed }       = require('./social');
const { getTwitterTimeline }  = require('./social-twitter');
const { getNewsletterFeed }   = require('./social-newsletters');
const { getCalendarEvents }   = require('./calendar');
const { generateMorningSummary } = require('./ai-summary');
const { buildEmailHtml }      = require('./email-template');

// ─── Config ──────────────────────────────────────────────────────────────────

const RESEND_API_URL  = 'https://api.resend.com/emails';
const FROM_EMAIL      = process.env.DIGEST_FROM_EMAIL || 'briefing@mydailybriefing.app';
const FROM_NAME       = process.env.DIGEST_FROM_NAME  || 'mydailybriefing.app';
const RATE_LIMIT_MS   = 1000; // 1 email per second

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine whether a user has an active Pro (or trial) subscription.
 * Mirrors the isUserPro() helper in server.js.
 */
function isUserPro(user) {
  if (user.is_pro) {
    if (!user.pro_expires_at) return true;
    return new Date(user.pro_expires_at) > new Date();
  }
  const trialEnd = new Date(user.created_at);
  trialEnd.setDate(trialEnd.getDate() + 14);
  return new Date() < trialEnd;
}

/**
 * Fetch all users from the DB.
 * Uses the raw better-sqlite3 connection exposed by db.js.
 *
 * @returns {object[]} Array of raw user rows (already parsed via parseUser
 *   if we go through the db module, but here we use the prepare API directly)
 */
function getAllUsers() {
  // We re-use rawDb (the better-sqlite3 Database instance) directly.
  // getUserByToken already calls parseUser, so we replicate the same select
  // but for all rows, then parse through getUserByToken to reuse parseUser logic.
  const rows = rawDb.prepare('SELECT token FROM users').all();
  return rows
    .map(r => getUserByToken(r.token))
    .filter(Boolean);
}

/**
 * Generate the briefing data for a single user.
 * This is a direct port of the /api/users/:token/briefing handler logic,
 * extracted here so it can be called without an HTTP round-trip.
 *
 * @param {object} user  Parsed user object from db.js
 * @returns {Promise<object>} Briefing data (sections + morning_summary)
 */
async function generateBriefingForUser(user) {
  // Resolve geo
  let geoData = {
    lat:   user.lat,
    lng:   user.lng,
    city:  user.city,
    state: user.state,
  };
  if (!geoData.lat && user.zip_code) {
    try { geoData = await resolveZip(user.zip_code); } catch (_) {}
  }

  // Fetch NWS grid for weather
  let nwsGrid = null;
  if (geoData.lat && geoData.lng) {
    try {
      const geo = await resolveZip(user.zip_code);
      nwsGrid = geo.nwsGrid;
    } catch (_) {}
  }

  // Fetch all sections in parallel, each fails gracefully
  const [
    weather, markets, national_news, local_news, sports, interests_news,
    local_accounts, hyper_local, politics, hs_sports, community_life,
    social_feed, calendar,
  ] = await Promise.all([
    geoData.lat
      ? content.getWeather(geoData.lat, geoData.lng, nwsGrid).catch(() => null)
      : Promise.resolve(null),
    content.getMarkets(user.stocks && user.stocks.length ? user.stocks : ['SPY', 'QQQ', 'BTC-USD']).catch(() => []),
    content.getNationalNews().catch(() => []),
    (geoData.city && geoData.state)
      ? content.getLocalNews(geoData.city, geoData.state).catch(() => [])
      : Promise.resolve([]),
    content.getSportsNews(user.sports_teams || []).catch(() => []),
    content.getTopicNews(user.interests || []).catch(() => []),
    (geoData.city && geoData.state)
      ? getLocalAccounts(geoData.city, geoData.state).catch(() => ({}))
      : Promise.resolve({}),
    getHyperLocal({ city: geoData.city, state: geoData.state, zip_code: user.zip_code, lat: geoData.lat, lng: geoData.lng }).catch(() => ({})),
    getPolitics(user.zip_code, geoData.city, geoData.state).catch(() => ({})),
    getHSSports({ city: geoData.city, state: geoData.state, hs_teams: user.hs_teams || [] }).catch(() => ({})),
    getCommunity({ city: geoData.city, state: geoData.state }).catch(() => ({})),
    (async () => {
      const substackFeeds = Array.isArray(user.substack_feeds) ? user.substack_feeds : [];
      const [base, tweets, newsletters] = await Promise.all([
        getSocialFeed(user.twitter_handles || [], user.interests || []).catch(() => ({ items: [] })),
        user.twitter_access_token
          ? getTwitterTimeline(user.token, { maxResults: 20 }).catch(() => [])
          : Promise.resolve([]),
        getNewsletterFeed(substackFeeds).catch(() => []),
      ]);
      const allItems = [...tweets, ...newsletters, ...(base.items || [])];
      const seen = new Set();
      const deduped = allItems.filter(i => {
        const k = (i.title || i.text || '').toLowerCase().trim();
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      });
      return {
        items: deduped.slice(0, 30),
        has_handles: (user.twitter_handles || []).length > 0,
        has_twitter_connected: !!user.twitter_access_token,
        has_newsletters: substackFeeds.length > 0,
        empty: deduped.length === 0,
      };
    })(),
    getCalendarEvents(user.token).catch(() => []),
  ]);

  // Annotate weather
  if (weather && weather.current) {
    weather.current.action = content.getWeatherAction(weather.current);
  }

  // Cross-section deduplication (mirrors server.js logic)
  const { dedupAgainst, dedup } = content;
  const localNewsItems = Array.isArray(local_news) ? local_news : [];

  if (politics) {
    const polAllRaw = [
      ...(politics.governor_news     || []),
      ...(politics.state_legislature || []),
      ...(politics.federal_news      || []),
      ...(politics.county            || []),
    ];
    const polDeduped = dedup(polAllRaw, 0.5);
    politics.governor_news     = polDeduped.slice(0, 8);
    politics.state_legislature = [];
    politics.federal_news      = [];
    politics.county            = [];
  }

  if (hyper_local) {
    const hlAllRaw = [
      ...(hyper_local.civic           || []),
      ...(hyper_local.local_business  || []),
      ...(hyper_local.events          || []),
      ...(hyper_local.community_pulse || []),
      ...(hyper_local.neighborhood    || []),
    ];
    const hlDeduped = dedup(hlAllRaw, 0.5);
    const hlSeen = new Set();
    const repartition = (arr) => arr.filter(item => {
      const key = (item.title || '').toLowerCase().trim();
      if (hlSeen.has(key)) return false;
      const survived = hlDeduped.some(d => d.title === item.title);
      if (survived) { hlSeen.add(key); return true; }
      return false;
    });
    hyper_local.civic           = repartition(hyper_local.civic           || []);
    hyper_local.local_business  = repartition(hyper_local.local_business  || []);
    hyper_local.events          = repartition(hyper_local.events          || []);
    hyper_local.community_pulse = repartition(hyper_local.community_pulse || []);
    hyper_local.neighborhood    = repartition(hyper_local.neighborhood    || []);
  }

  if (hyper_local && Array.isArray(hyper_local.news)) {
    hyper_local.news = dedupAgainst(hyper_local.news, localNewsItems);
  }
  if (hyper_local && Array.isArray(hyper_local.civic)) {
    hyper_local.civic = dedupAgainst(hyper_local.civic, localNewsItems);
  }

  const seenLocal = [
    ...localNewsItems,
    ...(hyper_local?.news  || []),
    ...(hyper_local?.civic || []),
  ];
  const interests_deduped = dedupAgainst(Array.isArray(interests_news) ? interests_news : [], seenLocal);
  const national_deduped  = dedupAgainst(Array.isArray(national_news)  ? national_news  : [], localNewsItems);

  // AI morning summary
  let morning_summary = null;
  try {
    morning_summary = await generateMorningSummary(
      { weather, markets, local_news, national_news: national_deduped },
      user.email?.split('@')[0]
    );
  } catch (_) {}

  return {
    morning_summary,
    location: geoData.displayName || (geoData.city && geoData.state ? `${geoData.city}, ${geoData.state}` : ''),
    sections: {
      weather,
      markets,
      national_news: national_deduped,
      local_news,
      sports,
      interests: interests_deduped,
      local_accounts,
      hyper_local,
      politics,
      hs_sports,
      community_life,
      social_feed,
      calendar,
    },
  };
}

/**
 * Send a single email via the Resend REST API.
 *
 * @param {object} opts
 * @param {string} opts.to      Recipient email address
 * @param {string} opts.subject Email subject
 * @param {string} opts.html    HTML body
 * @returns {Promise<void>}
 */
async function sendViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY env var is not set');

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    `${FROM_NAME} <${FROM_EMAIL}>`,
      to:      [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Send the daily digest to all users who have an email address.
 *
 * @returns {Promise<{ sent: number, failed: number, total: number }>}
 */
async function sendDailyDigest() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is required');
  }

  // Format date once for the subject line and email header
  const now       = new Date();
  const dateStr   = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const subject   = `Your Daily Briefing \u2014 ${dateStr}`;

  const users = getAllUsers().filter(u => u.email);
  const total = users.length;
  let sent   = 0;
  let failed = 0;

  console.log(`[digest] Starting daily digest for ${total} user(s) — ${dateStr}`);

  for (let i = 0; i < users.length; i++) {
    const user = users[i];

    // Rate limit: wait between emails (skip wait before the very first one)
    if (i > 0) await sleep(RATE_LIMIT_MS);

    try {
      // 1. Generate briefing data
      const briefing = await generateBriefingForUser(user);

      // 2. Determine Pro status
      const isPro = isUserPro(user);

      // 3. Build HTML email
      const userName = user.email.split('@')[0];
      const html = buildEmailHtml({
        date:            dateStr,
        userName,
        location:        briefing.location,
        sections:        briefing.sections,
        morning_summary: briefing.morning_summary,
        isPro,
      });

      // 4. Send via Resend
      await sendViaResend({ to: user.email, subject, html });

      sent++;
      console.log(`[digest] ✓ Sent to ${user.email} (${i + 1}/${total})`);
    } catch (err) {
      failed++;
      console.error(`[digest] ✗ Failed for ${user.email} (${i + 1}/${total}): ${err.message}`);
    }
  }

  console.log(`[digest] Done — sent: ${sent}, failed: ${failed}, total: ${total}`);
  return { sent, failed, total };
}

module.exports = { sendDailyDigest };
