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

const app  = express();
const PORT = process.env.PORT || 3001;
const BRIEF_CACHE_TTL_MS = 15 * 60 * 1000;
const briefingCache = new Map();

function clearExpiredBriefCache() {
  const now = Date.now();
  for (const [token, entry] of briefingCache.entries()) {
    if (!entry || now - entry.timestamp > BRIEF_CACHE_TTL_MS) {
      briefingCache.delete(token);
    }
  }
}

function getCachedBrief(token) {
  clearExpiredBriefCache();
  const entry = briefingCache.get(token);
  if (!entry) return null;
  console.log(`[brief-cache] hit for token ${token}`);
  return entry.payload;
}

function setCachedBrief(token, payload) {
  briefingCache.set(token, { payload, timestamp: Date.now() });
}

function invalidateCachedBrief(token) {
  briefingCache.delete(token);
}

app.use(cors({
  origin: [
    'https://mydailybriefing.app',
    'https://www.mydailybriefing.app',
    'https://mydailybriefing.surge.sh',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    /trycloudflare\.com$/,
    /surge\.sh$/,
  ],
  credentials: true,
}));
app.use(express.json());

// ─────────────────────────────────────────────
//  Health check
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

    invalidateCachedBrief(user.token);

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
    invalidateCachedBrief(token);
    res.json(updated);
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  Personalized Briefing
// ─────────────────────────────────────────────

// GET /api/users/:token/briefing
app.get('/api/users/:token/briefing', async (req, res) => {
  try {
    const { token } = req.params;
    const cached = getCachedBrief(token);
    if (cached) {
      return res.json(cached);
    }

    const user = db.getUserByToken(token);
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
    const [weather, markets, national_news, local_news, sports, interests_news, local_accounts, hyper_local, politics, hs_sports, community_life] =
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
      ]);

    // Annotate weather with actionable summary
    if (weather && weather.current) {
      weather.current.action = content.getWeatherAction(weather.current);
    }

    // Cross-section deduplication — remove stories already seen in higher-priority sections
    // Priority: local_news > hyper_local news > interests > national_news
    const { dedupAgainst } = content;
    const localNewsItems = Array.isArray(local_news) ? local_news : [];

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

    const payload = {
      generated_at: new Date().toISOString(),
      user: {
        email:    user.email,
        location: geoData.displayName || `${geoData.city}, ${geoData.state}`,
      },
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
      },
    };

    setCachedBrief(token, payload);
    res.json(payload);
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
//  Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`📡 Briefing API running on http://localhost:${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  POST /api/users/signup`);
  console.log(`  GET  /api/users/:token/profile`);
  console.log(`  PUT  /api/users/:token/profile`);
  console.log(`  GET  /api/users/:token/briefing`);
  console.log(`  GET  /api/geo/zip/:zip`);
});

module.exports = app;
