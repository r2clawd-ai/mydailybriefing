#!/usr/bin/env node
/**
 * Briefing App Backend API
 * Personalized daily briefing engine
 */

const express = require('express');
const cors    = require('cors');
const { exec } = require('child_process');
const fs      = require('fs').promises;
const path    = require('path');

const db      = require('./db');
const { resolveZip } = require('./geo');
const content = require('./content');
const { getLocalAccounts, getSuggestedNational } = require('./geo-accounts');
const { getHyperLocal }  = require('./hyper-local');
const { getPolitics }    = require('./politics');
const { getHSSports }    = require('./hs-sports');
const { getCommunity }   = require('./community');
const { getSocialFeed }        = require('./social');
const { getTwitterTimeline }   = require('./social-twitter');
const { getNewsletterFeed }    = require('./social-newsletters');
const { normalizeFeedUrl }     = require('./social-newsletters');
const { registerTwitterAuthRoutes } = require('./oauth-twitter');
const { registerGoogleAuthRoutes } = require('./oauth-google');
const { getCalendarEvents } = require('./calendar');
const payments = require('./payments');
const stripe   = require('./stripe');   // new Stripe module (stripe.js)
const { generateMorningSummary, enhanceHeadlines } = require('./ai-summary');
const { registerReferralRoutes } = require('./referral');

const app  = express();
const PORT = process.env.PORT || 3001;

function isUserPro(user) {
  if (user.is_pro) {
    if (!user.pro_expires_at) return true;
    return new Date(user.pro_expires_at) > new Date();
  }

  const trialEnd = new Date(user.created_at);
  trialEnd.setDate(trialEnd.getDate() + 14);
  return new Date() < trialEnd;
}

const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [];

app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      'https://mydailybriefing.app',
      'https://www.mydailybriefing.app',
      'https://mydailybriefing-api-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      ...ALLOWED_ORIGINS_ENV,
    ];
    if (!origin || allowed.includes(origin) || /trycloudflare\.com$/.test(origin)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json());

// ── Serve frontend static files ───────────────────────────────────
const publicDir = path.join(__dirname, 'public');
if (require('fs').existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback for root
  app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

registerTwitterAuthRoutes(app);
registerGoogleAuthRoutes(app);
registerReferralRoutes(app);

// ─────────────────────────────────────────────
//  Health check
// ─────────────────────────────────────────────
function healthHandler(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}
app.get('/health',     healthHandler);
app.get('/api/health', healthHandler);

// ─────────────────────────────────────────────
//  Geo
// ─────────────────────────────────────────────

// GET /api/geo/zip/:zip
app.get('/api/geo/zip/:zip', async (req, res) => {
  try {
    const geo = await resolveZip(req.params.zip);
    res.json(geo);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/geo/accounts?city=Sioux+Falls&state=SD&interests=Finance,Sports
app.get('/api/geo/accounts', async (req, res) => {
  try {
    const { city, state, interests } = req.query;
    if (!city || !state) return res.status(400).json({ error: 'city and state required' });
    const interestList = interests ? interests.split(',') : [];
    const result = await getLocalAccounts(city, state);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/geo/reverse?lat=...&lng=...
app.get('/api/geo/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    // Use the Census Bureau reverse geocoder (free, no key needed)
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const censusRes = await require('node-fetch')(censusUrl);
    if (censusRes.ok) {
      const data = await censusRes.json();
      const geo = data?.result?.geographies?.['Incorporated Places']?.[0]
                || data?.result?.geographies?.['Census Designated Places']?.[0];
      const state = data?.result?.geographies?.['States']?.[0];
      const zips = data?.result?.geographies?.['ZIP Code Tabulation Areas']?.[0];
      const city = geo?.NAME || state?.NAME || '';
      const stateAbbr = state?.STUSAB || state?.STATE || '';
      const zip = zips?.ZCTA5CE || zips?.GEOID || '';
      if (city || zip) {
        return res.json({ city, state: stateAbbr, zip, lat: parseFloat(lat), lng: parseFloat(lng) });
      }
    }

    // Fallback: use NWS points API (already used in the codebase)
    const nwsRes = await require('node-fetch')(
      `https://api.weather.gov/points/${lat},${lng}`,
      { headers: { 'User-Agent': 'BriefingApp/1.0 contact@example.com' } }
    );
    if (!nwsRes.ok) throw new Error('Reverse geocoding failed');
    const nwsData = await nwsRes.json();
    const props = nwsData.properties;
    res.json({
      city: props.relativeLocation?.properties?.city || '',
      state: props.relativeLocation?.properties?.state || '',
      zip: '',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  User endpoints
// ─────────────────────────────────────────────

// POST /api/users/signup
app.post('/api/users/signup', async (req, res) => {
  try {
    const {
      email, zip_code,
      interests        = [],
      sports_teams     = [],
      celeb_topics     = [],
      twitter_handles  = [],
      stocks           = [],
      hs_teams         = [],
    } = req.body;

    if (!email || !zip_code) {
      return res.status(400).json({ error: 'email and zip_code are required' });
    }

    // Check for duplicate email
    const existing = db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered', token: existing.token });
    }

    // Resolve geo
    let geoData = {};
    try {
      geoData = await resolveZip(zip_code);
    } catch (e) {
      console.warn('Geo resolve failed during signup:', e.message);
    }

    const user = db.createUser({
      email, zip_code,
      city:  geoData.city  || null,
      state: geoData.state || null,
      lat:   geoData.lat   || null,
      lng:   geoData.lng   || null,
      interests, sports_teams, celeb_topics, twitter_handles, stocks, hs_teams,
    });

    res.status(201).json({ userId: user.id, token: user.token, profile: user });
  } catch (e) {
    console.error('Signup error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/users/:token/profile
app.get('/api/users/:token/profile', (req, res) => {
  const user = db.getUserByToken(req.params.token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users/:token/substack — add a newsletter feed
app.post('/api/users/:token/substack', (req, res) => {
  const user = db.getUserByToken(req.params.token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const url = normalizeFeedUrl(req.body.url);
  if (!url) return res.status(400).json({ error: 'Invalid URL' });
  const feeds = JSON.parse(user.substack_feeds || '[]');
  if (!feeds.includes(url)) feeds.push(url);
  db.updateUser(req.params.token, { substack_feeds: JSON.stringify(feeds) });
  res.json({ substack_feeds: feeds });
});

// DELETE /api/users/:token/substack — remove a newsletter feed
app.delete('/api/users/:token/substack', (req, res) => {
  const user = db.getUserByToken(req.params.token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const url = normalizeFeedUrl(req.body.url) || req.body.url;
  const feeds = JSON.parse(user.substack_feeds || '[]').filter(f => f !== url);
  db.updateUser(req.params.token, { substack_feeds: JSON.stringify(feeds) });
  res.json({ substack_feeds: feeds });
});

// GET /api/users/:token/subscription — Pro status
app.get('/api/users/:token/subscription', (req, res) => {
  const user = db.getUserByToken(req.params.token);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const trialEnd = new Date(user.created_at);
  trialEnd.setDate(trialEnd.getDate() + 14);
  const now = new Date();
  const isTrial = now < trialEnd && !user.is_pro;
  const isPro = user.is_pro
    ? (!user.pro_expires_at || new Date(user.pro_expires_at) > now)
    : isTrial;
  const trialDaysLeft = isTrial ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : 0;
  res.json({
    isPro, isTrial, trialDaysLeft,
    status: isPro ? (isTrial ? 'free_trial' : 'pro') : 'free',
    isActive: isPro,
    trialEnd: trialEnd.toISOString(),
    features: {
      socialConnected: isPro,
      unlimitedLocations: isPro,
      priorityRefresh: isPro,
      emailDigest: isPro,
    }
  });
});

// POST /api/checkout — create Stripe checkout session
// Body: { token: string, priceId?: string }
// Uses stripe.js (which updates is_pro); falls back to payments.js if stripe.js fails.
app.post('/api/checkout', async (req, res) => {
  try {
    const { token, priceId } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    // TODO: Steven — ensure STRIPE_SECRET_KEY and STRIPE_PRICE_ID are set in env
    const result = await stripe.createCheckoutSession(token, priceId);
    res.json(result);
  } catch (err) {
    console.error('[checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/:token — customer billing portal
app.post('/api/portal/:token', async (req, res) => {
  try {
    const origin = req.headers.origin || 'https://mydailybriefing.app';
    const result = await payments.createPortalSession(
      db.db,
      req.params.token,
      `${origin}/briefing.html?token=${req.params.token}`
    );
    res.json(result);
  } catch (err) {
    console.error('[portal]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhook — Stripe webhook (raw body required) [legacy payments.js path]
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const result = await payments.handleWebhook(db.db, req.body, sig);
    res.json(result);
  } catch (err) {
    console.error('[webhook]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/webhooks/stripe — Stripe webhook via stripe.js (updates is_pro in DB)
// TODO: Steven — register THIS URL in Stripe Dashboard → Developers → Webhooks
//       e.g. https://mydailybriefing-api-production.up.railway.app/api/webhooks/stripe
//       Events to enable: checkout.session.completed, customer.subscription.deleted,
//                         customer.subscription.updated, invoice.payment_failed
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const result = await stripe.handleWebhook(req.body, sig);
    res.json(result);
  } catch (err) {
    console.error('[webhooks/stripe]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/users/:token/profile
app.put('/api/users/:token/profile', async (req, res) => {
  try {
    const { token } = req.params;
    const existing  = db.getUserByToken(token);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updates = { ...req.body };

    // If zip_code changed, re-resolve geo
    if (updates.zip_code && updates.zip_code !== existing.zip_code) {
      try {
        const geo  = await resolveZip(updates.zip_code);
        updates.city  = geo.city;
        updates.state = geo.state;
        updates.lat   = geo.lat;
        updates.lng   = geo.lng;
      } catch (e) {
        console.warn('Geo re-resolve failed:', e.message);
      }
    }

    const updated = db.updateUser(token, updates);
    res.json(updated);
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/users/:token/substack', (req, res) => {
  try {
    const user = db.getUserByToken(req.params.token);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentFeeds = Array.isArray(user.substack_feeds) ? user.substack_feeds : [];
    const { url, action = 'add', feeds } = req.body || {};

    let nextFeeds = currentFeeds;
    if (Array.isArray(feeds)) {
      nextFeeds = [...new Set(feeds.map(normalizeFeedUrl).filter(Boolean))];
    } else {
      const normalized = normalizeFeedUrl(url);
      if (!normalized) {
        return res.status(400).json({ error: 'A valid Substack or RSS URL is required' });
      }

      if (action === 'remove') {
        nextFeeds = currentFeeds.filter((feedUrl) => feedUrl !== normalized);
      } else {
        nextFeeds = [...new Set([...currentFeeds, normalized])];
      }
    }

    const updated = db.updateUser(req.params.token, { substack_feeds: nextFeeds });
    res.json({ substack_feeds: updated.substack_feeds });
  } catch (error) {
    console.error('Substack update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:token/calendar-ics', (req, res) => {
  try {
    const user = db.getUserByToken(req.params.token);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'url is required' });
    }

    const normalizedUrl = rawUrl.replace(/^webcal:\/\//i, 'https://');
    let parsed;
    try {
      parsed = new URL(normalizedUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid calendar URL' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Invalid calendar URL' });
    }

    const updated = db.updateUser(req.params.token, {
      calendar_ics_url: parsed.toString(),
    });

    res.json({ calendar_ics_url: updated.calendar_ics_url });
  } catch (error) {
    console.error('Calendar ICS update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:token/calendar', async (req, res) => {
  try {
    const user = db.getUserByToken(req.params.token);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const events = await getCalendarEvents(req.params.token, { days: 1 });
    res.json({ events });
  } catch (error) {
    console.error('Calendar route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
//  Personalized Briefing
// ─────────────────────────────────────────────

// GET /api/users/:token/briefing
app.get('/api/users/:token/briefing', async (req, res) => {
  try {
    const user = db.getUserByToken(req.params.token);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Resolve geo if not already cached
    let geoData = {
      lat: user.lat, lng: user.lng,
      city: user.city, state: user.state,
    };
    if (!geoData.lat && user.zip_code) {
      try { geoData = await resolveZip(user.zip_code); } catch (_) {}
    }

    // Fetch nwsGrid for weather
    let nwsGrid = null;
    if (geoData.lat && geoData.lng) {
      try {
        const geo = await resolveZip(user.zip_code);
        nwsGrid = geo.nwsGrid;
      } catch (_) {}
    }

    // Fetch all sections in parallel, each fails gracefully
    const [weather, markets, national_news, local_news, sports, interests_news, local_accounts, hyper_local, politics, hs_sports, community_life, social_feed, calendar] =
      await Promise.all([
        geoData.lat
          ? content.getWeather(geoData.lat, geoData.lng, nwsGrid).catch(() => null)
          : Promise.resolve(null),
        content.getMarkets(user.stocks.length ? user.stocks : ['SPY', 'QQQ', 'BTC-USD']).catch(() => []),
        content.getNationalNews().catch(() => []),
        (geoData.city && geoData.state)
          ? content.getLocalNews(geoData.city, geoData.state).catch(() => [])
          : Promise.resolve([]),
        content.getSportsNews(user.sports_teams).catch(() => []),
        content.getTopicNews(user.interests).catch(() => []),
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
              ? getTwitterTimeline(req.params.token, { maxResults: 20 }).catch(() => [])
              : Promise.resolve([]),
            getNewsletterFeed(substackFeeds).catch(() => []),
          ]);
          const allItems = [...tweets, ...newsletters, ...(base.items || [])];
          // Dedup by title or text so tweet/newsletter items merge cleanly.
          const seen = new Set();
          const deduped = allItems.filter(i => {
            const k = (i.title || i.text || '').toLowerCase().trim();
            if (!k || seen.has(k)) return false;
            seen.add(k); return true;
          });
          return {
            items: deduped.slice(0, 30),
            has_handles: (user.twitter_handles||[]).length > 0,
            has_twitter_connected: !!user.twitter_access_token,
            has_newsletters: substackFeeds.length > 0,
            empty: deduped.length === 0,
          };
        })(),
        getCalendarEvents(req.params.token).catch(() => []),
      ]);

    // Annotate weather with actionable summary
    if (weather && weather.current) {
      weather.current.action = content.getWeatherAction(weather.current);
    }

    // Cross-section deduplication — remove stories already seen in higher-priority sections
    // Priority: local_news > hyper_local news > interests > national_news
    const { dedupAgainst, dedup } = content;
    const localNewsItems = Array.isArray(local_news) ? local_news : [];

    // Deduplicate politics sub-arrays against each other (same story from multiple feeds)
    if (politics) {
      const polAllRaw = [
        ...(politics.governor_news     || []),
        ...(politics.state_legislature || []),
        ...(politics.federal_news      || []),
        ...(politics.county            || []),
      ];
      // dedup with a lower threshold (0.35) to catch paraphrased headlines
      const polDeduped = dedup(polAllRaw, 0.5);
      // Reassign back — put deduped items into governor_news, clear the rest
      politics.governor_news     = polDeduped.slice(0, 8);
      politics.state_legislature = [];
      politics.federal_news      = [];
      politics.county            = [];
    }

    // Deduplicate all hyper_local sub-sections against each other first, then against local_news
    if (hyper_local) {
      const hlAllRaw = [
        ...(hyper_local.civic             || []),
        ...(hyper_local.local_business    || []),
        ...(hyper_local.events            || []),
        ...(hyper_local.community_pulse   || []),
        ...(hyper_local.neighborhood      || []),
      ];
      const hlDeduped = dedup(hlAllRaw, 0.5);
      // Re-partition back into sections, maintaining relative order
      const hlSeen = new Set();
      const repartition = (arr) => arr.filter(item => {
        const key = (item.title||'').toLowerCase().trim();
        if (hlSeen.has(key)) return false;
        // Check if this item survived the cross-dedup
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

    // Deduplicate hyper_local news against local_news
    if (hyper_local && Array.isArray(hyper_local.news)) {
      hyper_local.news = dedupAgainst(hyper_local.news, localNewsItems);
    }
    if (hyper_local && Array.isArray(hyper_local.civic)) {
      hyper_local.civic = dedupAgainst(hyper_local.civic, localNewsItems);
    }

    // Deduplicate interests against local_news + hyper_local combined
    const seenLocal = [
      ...localNewsItems,
      ...(hyper_local?.news || []),
      ...(hyper_local?.civic || []),
    ];
    const interests_deduped = dedupAgainst(Array.isArray(interests_news) ? interests_news : [], seenLocal);

    // Deduplicate national_news against local (national stories sometimes echo local)
    const national_deduped = dedupAgainst(
      Array.isArray(national_news) ? national_news : [],
      localNewsItems
    );

    // Generate AI morning summary (non-blocking, fails gracefully)
    let morning_summary = null;
    try {
      const summaryData = { weather, markets, local_news, national_news: national_deduped };
      morning_summary = await generateMorningSummary(summaryData, user.email?.split('@')[0]);
    } catch (_) {}

    res.json({
      generated_at: new Date().toISOString(),
      user: {
        email:    user.email,
        location: geoData.displayName || `${geoData.city}, ${geoData.state}`,
      },
      morning_summary,
      sections: {
        weather,
        markets,
        national_news: national_deduped,
        local_news,
        sports,
        interests: interests_deduped,
        local_accounts,
        suggested_accounts: getSuggestedNational(user.interests),
        hyper_local,
        politics,
        hs_sports,
        community_life,
        social_feed,
        calendar,
      },
    });
  } catch (e) {
    console.error('Briefing error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  Legacy endpoints (backward compat)
// ─────────────────────────────────────────────

app.get('/api/briefing/latest', async (req, res) => {
  try {
    const data = await generateLegacyBriefingData();
    res.json(data);
  } catch (e) {
    console.error('Legacy briefing error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/briefing/section/:sectionName', async (req, res) => {
  try {
    const { sectionName } = req.params;
    const data = await getLegacySection(sectionName);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  Legacy helpers
// ─────────────────────────────────────────────

async function generateLegacyBriefingData() {
  return {
    generated_at: new Date().toISOString(),
    sections: {
      markets: await getLegacyMarkets(),
      weather: await getLegacyWeather(),
      calendar: await getLegacyCalendar(),
      news:    await content.getNationalNews().catch(() => ({ articles: [], count: 0 })),
      portfolio: { balance: 0, positions: [], error: 'See /api/users/:token/briefing' },
    },
    metadata: { version: '2.0.0', source: 'briefing-backend', cached: false },
  };
}

async function getLegacyMarkets() {
  const data = await content.getMarkets(['SPY', 'QQQ', 'BTC-USD']).catch(() => []);
  return { timestamp: new Date().toISOString(), movers: data, count: data.length };
}

async function getLegacyWeather() {
  // Default to Sioux Falls, SD
  const w = await content.getWeather(43.5473, -96.7283).catch(() => null);
  if (!w) return { error: 'Weather unavailable' };
  return { location: 'Sioux Falls, SD', current: w.current, today: w.periods?.slice(0, 2) || [], timestamp: new Date().toISOString() };
}

async function getLegacyCalendar() {
  return new Promise((resolve) => {
    exec('/opt/homebrew/bin/icalBuddy -n -nc -iep "title,datetime" -po "datetime,title" -df "%Y-%m-%d" -tf "%H:%M" -b "" eventsToday',
      (error, stdout) => {
        if (error) { resolve({ count: 0, events: [], timestamp: new Date().toISOString() }); return; }
        const events = [];
        for (const line of stdout.trim().split('\n')) {
          const m = line.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)/);
          if (m) events.push({ date: m[1], time: m[2], title: m[3] });
        }
        resolve({ count: events.length, events, timestamp: new Date().toISOString() });
      }
    );
  });
}

async function getLegacySection(name) {
  const map = {
    markets:  getLegacyMarkets,
    weather:  getLegacyWeather,
    calendar: getLegacyCalendar,
    news:     () => content.getNationalNews(),
    portfolio: () => Promise.resolve({ balance: 0, positions: [] }),
  };
  const fn = map[name];
  if (!fn) throw new Error(`Unknown section: ${name}`);
  return fn();
}

// ─────────────────────────────────────────────
//  Admin
// ─────────────────────────────────────────────

// POST /api/admin/send-digest
// Requires Authorization: Bearer <ADMIN_SECRET>
app.post('/api/admin/send-digest', async (req, res) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ error: 'ADMIN_SECRET is not configured on this server' });
    }

    // Validate Authorization header
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token || token !== adminSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sendDailyDigest } = require('./email-digest');
    const result = await sendDailyDigest();

    res.json({
      ok: true,
      sent:   result.sent,
      failed: result.failed,
      total:  result.total,
    });
  } catch (err) {
    console.error('[admin/send-digest]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`📡 Briefing API running on http://localhost:${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  POST /api/users/signup`);
  console.log(`  GET  /api/users/:token/profile`);
  console.log(`  PUT  /api/users/:token/profile`);
  console.log(`  GET  /api/users/:token/calendar`);
  console.log(`  PUT  /api/users/:token/calendar-ics`);
  console.log(`  GET  /api/users/:token/briefing`);
  console.log(`  GET  /api/geo/zip/:zip`);
  console.log(`  POST /api/referral/apply`);
  console.log(`  GET  /api/users/:token/referral-stats`);
});

module.exports = app;

// ─────────────────────────────────────────────
//  Waitlist endpoint
// ─────────────────────────────────────────────
app.post('/api/waitlist', async (req, res) => {
  try {
    const { email, zip_code, source } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    // Check if already a full user
    const existing = db.getUserByEmail(email);
    if (existing) {
      return res.json({ status: 'already_registered', token: existing.token });
    }

    // Store in waitlist table
    db.db.exec(`CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      zip_code TEXT,
      source TEXT,
      created_at TEXT NOT NULL
    )`);
    
    const id = require('uuid').v4();
    try {
      db.db.prepare('INSERT INTO waitlist (id, email, zip_code, source, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, email.toLowerCase().trim(), zip_code || null, source || 'direct', new Date().toISOString());
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        return res.json({ status: 'already_waitlisted' });
      }
      throw e;
    }

    console.log(`[waitlist] New signup: ${email} from ${source || 'direct'}`);
    res.json({ status: 'waitlisted', message: 'You\'re on the list!' });
  } catch (e) {
    console.error('[waitlist]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/waitlist/count — public count for social proof
app.get('/api/waitlist/count', (req, res) => {
  try {
    db.db.exec(`CREATE TABLE IF NOT EXISTS waitlist (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, zip_code TEXT, source TEXT, created_at TEXT NOT NULL)`);
    const users = db.db.prepare('SELECT COUNT(*) as count FROM users').get();
    const wl = db.db.prepare('SELECT COUNT(*) as count FROM waitlist').get();
    res.json({ total: (users?.count || 0) + (wl?.count || 0) });
  } catch (e) {
    res.json({ total: 0 });
  }
});

// ─────────────────────────────────────────────
//  SEO City Landing Pages
// ─────────────────────────────────────────────
const { SEO_CITIES, renderCityPage } = require('./seo');

app.get('/cities/:slug', (req, res) => {
  const city = SEO_CITIES.find(c => c.slug === req.params.slug);
  if (!city) return res.status(404).send('City not found');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(renderCityPage(city));
});

app.get('/cities', (req, res) => {
  const links = SEO_CITIES.map(c => 
    `<li><a href="/cities/${c.slug}">${c.city}, ${c.state}</a></li>`
  ).join('\n');
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><body><h1>Browse by City</h1><ul>${links}</ul></body></html>`);
});

// ── Trading Dashboard — Polymarket proxy (CORS bypass) ──────────────────────
app.get('/api/pm-positions', async (req, res) => {
  const wallet = '0x58A2e4C50f4b228D866b7222cF8cEd11c0E99Ae9';
  try {
    const r = await fetch(`https://data-api.polymarket.com/positions?user=${wallet}&limit=500`);
    if (!r.ok) return res.status(r.status).json({ error: `Polymarket ${r.status}` });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/sitemap-cities.xml', (req, res) => {
  const urls = SEO_CITIES.map(c => `
  <url>
    <loc>https://mydailybriefing.app/cities/${c.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');
  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});
