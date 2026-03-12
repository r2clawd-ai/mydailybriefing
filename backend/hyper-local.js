/**
 * hyper-local.js
 * Neighborhood and community-level content sources.
 * Goes deeper than city-level: Reddit community pulse, local events,
 * city government news, neighborhood-level Google News queries,
 * local business openings, and safety alerts.
 */

const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ─────────────────────────────────────────────────────────────────
// CITY → SUBREDDIT MAP
// Covers top ~80 US cities + fallback to r/cityname
// ─────────────────────────────────────────────────────────────────
const CITY_SUBREDDITS = {
  // SD
  'Sioux Falls':   'SiouxFalls',
  'Rapid City':    'RapidCity',
  // Midwest
  'Minneapolis':   'minneapolis',
  'Saint Paul':    'saintpaul',
  'Chicago':       'chicago',
  'Milwaukee':     'milwaukee',
  'Kansas City':   'kansascity',
  'St. Louis':     'StLouis',
  'Omaha':         'Omaha',
  'Indianapolis':  'Indianapolis',
  'Columbus':      'Columbus',
  'Cincinnati':    'cincinnati',
  'Cleveland':     'Cleveland',
  'Detroit':       'Detroit',
  'Des Moines':    'desmoines',
  // South
  'Dallas':        'Dallas',
  'Houston':       'houston',
  'Austin':        'Austin',
  'San Antonio':   'sanantonio',
  'Nashville':     'nashville',
  'Atlanta':       'Atlanta',
  'Miami':         'miami',
  'Tampa':         'tampa',
  'Orlando':       'orlando',
  'Charlotte':     'Charlotte',
  'Raleigh':       'raleigh',
  'Memphis':       'memphis',
  'Louisville':    'Louisville',
  'New Orleans':   'NewOrleans',
  'Jacksonville':  'jacksonville',
  // West
  'Los Angeles':   'LosAngeles',
  'San Diego':     'sandiego',
  'San Francisco': 'sanfrancisco',
  'Seattle':       'Seattle',
  'Portland':      'Portland',
  'Denver':        'Denver',
  'Las Vegas':     'vegaslocals',
  'Phoenix':       'phoenix',
  'Tucson':        'Tucson',
  'Sacramento':    'Sacramento',
  'Salt Lake City':'SaltLakeCity',
  'Albuquerque':   'Albuquerque',
  'Spokane':       'Spokane',
  'Boise':         'Boise',
  // Northeast
  'New York':      'nyc',
  'Boston':        'boston',
  'Philadelphia':  'philadelphia',
  'Pittsburgh':    'pittsburgh',
  'Buffalo':       'buffalo',
  'Baltimore':     'baltimore',
  'Washington':    'washingtondc',
  'Providence':    'RhodeIsland',
  'Hartford':      'Connecticut',
  // Other
  'Anchorage':     'anchorage',
  'Honolulu':      'Hawaii',
};

function getSubreddit(city) {
  // Direct match
  if (CITY_SUBREDDITS[city]) return CITY_SUBREDDITS[city];
  // Fuzzy: strip common suffixes
  const clean = city.replace(/\s*(city|town|village)\s*$/i, '').trim();
  if (CITY_SUBREDDITS[clean]) return CITY_SUBREDDITS[clean];
  // Fallback: lowercase city name (often works on Reddit)
  return city.toLowerCase().replace(/\s+/g, '');
}

// ─────────────────────────────────────────────────────────────────
// SOURCES
// ─────────────────────────────────────────────────────────────────

/**
 * Community pulse — what people in the city are talking about.
 * Uses Google News community-angle search (Reddit requires OAuth since 2023).
 * Returns: [ { title, url, source, type } ]
 */
async function getCommunityPulse(city, maxPosts = 5) {
  try {
    // Search for community discussion angles — what locals care about
    const queries = [
      `"${city}" residents OR community OR neighborhood`,
      `"${city}" opinion OR debate OR controversy`,
    ];

    const allItems = [];
    for (const q of queries) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
      if (!res.ok) continue;
      const text   = await res.text();
      const parsed = parser.parse(text);
      const items  = parsed?.rss?.channel?.item;
      const arr    = Array.isArray(items) ? items : (items ? [items] : []);
      allItems.push(...arr.slice(0, 3).map(i => ({
        title:  (i.title || '').replace(/\s*-\s*[^-]{2,40}$/, '').trim(),
        url:    i.link || i.guid || '',
        source: i.source?.['#text'] || '',
        type:   'community',
      })));
    }

    // Deduplicate
    const seen = new Set();
    return allItems.filter(i => {
      const key = i.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, maxPosts);
  } catch (e) {
    console.warn(`Community pulse failed for ${city}:`, e.message);
    return [];
  }
}

/**
 * Local events via Google News RSS — what's happening this week.
 */
async function getLocalEvents(city, state, maxItems = 5) {
  try {
    const queries = [
      `"${city}" events this week`,
      `"${city}" ${state} things to do weekend`,
    ];

    const allItems = [];
    for (const q of queries) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
      if (!res.ok) continue;
      const text   = await res.text();
      const parsed = parser.parse(text);
      const items  = parsed?.rss?.channel?.item;
      const arr    = Array.isArray(items) ? items : (items ? [items] : []);
      allItems.push(...arr.slice(0, 3).map(i => ({
        title:  (i.title || '').replace(/\s*-\s*[^-]{2,40}$/, '').trim(),
        url:    i.link || i.guid || '',
        source: i.source?.['#text'] || '',
        type:   'event',
      })));
    }

    // Deduplicate
    const seen = new Set();
    return allItems.filter(i => {
      const key = i.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, maxItems);
  } catch (e) {
    console.warn(`Local events error for ${city}:`, e.message);
    return [];
  }
}

/**
 * City government and civic news — city council, zoning, public safety.
 */
async function getCivicNews(city, state, maxItems = 4) {
  try {
    const q = `"${city}" city council OR mayor OR budget OR zoning OR ordinance`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
    if (!res.ok) return [];
    const text   = await res.text();
    const parsed = parser.parse(text);
    const items  = parsed?.rss?.channel?.item;
    const arr    = Array.isArray(items) ? items : (items ? [items] : []);
    return arr.slice(0, maxItems).map(i => ({
      title:  (i.title || '').replace(/\s*-\s*[^-]{2,40}$/, '').trim(),
      url:    i.link || i.guid || '',
      source: i.source?.['#text'] || '',
      type:   'civic',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Local business news — openings, closings, expansions.
 */
async function getLocalBusiness(city, state, maxItems = 4) {
  try {
    const q = `"${city}" new restaurant OR opening OR closing OR business`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
    if (!res.ok) return [];
    const text   = await res.text();
    const parsed = parser.parse(text);
    const items  = parsed?.rss?.channel?.item;
    const arr    = Array.isArray(items) ? items : (items ? [items] : []);
    return arr.slice(0, maxItems).map(i => ({
      title:  (i.title || '').replace(/\s*-\s*[^-]{2,40}$/, '').trim(),
      url:    i.link || i.guid || '',
      source: i.source?.['#text'] || '',
      type:   'business',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Public safety alerts via NWS alerts API.
 * Returns active weather alerts for the user's lat/lng.
 */
async function getSafetyAlerts(lat, lng) {
  if (!lat || !lng) return [];
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat},${lng}`,
      { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 }
    );
    if (!res.ok) return [];
    const data   = await res.json();
    const alerts = (data.features || []).slice(0, 3);
    return alerts.map(a => ({
      title:    a.properties.headline || a.properties.event,
      severity: a.properties.severity,
      urgency:  a.properties.urgency,
      type:     'alert',
      expires:  a.properties.expires,
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Neighborhood-level deep dive — more specific Google News query
 * using known neighborhood names for major cities.
 */
async function getNeighborhoodNews(city, state, zip) {
  // For now, do a precise city+zip Google News search
  try {
    const q = `"${city}" ${zip}`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
    if (!res.ok) return [];
    const text   = await res.text();
    const parsed = parser.parse(text);
    const items  = parsed?.rss?.channel?.item;
    const arr    = Array.isArray(items) ? items : (items ? [items] : []);
    return arr.slice(0, 3).map(i => ({
      title:  (i.title || '').replace(/\s*-\s*[^-]{2,40}$/, '').trim(),
      url:    i.link || i.guid || '',
      source: i.source?.['#text'] || '',
      type:   'neighborhood',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Master hyper-local fetch — runs all sources in parallel for a user.
 * @param {object} user  { city, state, zip, lat, lng }
 * @returns {object}     { community_pulse, events, civic, local_business, alerts, neighborhood }
 */
async function getHyperLocal(user) {
  const { city, state, zip_code: zip, lat, lng } = user;
  if (!city || !state) {
    return { community_pulse: [], events: [], civic: [], local_business: [], alerts: [], neighborhood: [] };
  }

  const [community_pulse, events, civic, local_business, alerts, neighborhood] = await Promise.all([
    getCommunityPulse(city).catch(() => []),
    getLocalEvents(city, state).catch(() => []),
    getCivicNews(city, state).catch(() => []),
    getLocalBusiness(city, state).catch(() => []),
    getSafetyAlerts(lat, lng).catch(() => []),
    getNeighborhoodNews(city, state, zip).catch(() => []),
  ]);

  return { community_pulse, events, civic, local_business, alerts, neighborhood };
}

module.exports = {
  getHyperLocal,
  getCommunityPulse,
  getLocalEvents,
  getCivicNews,
  getLocalBusiness,
  getSafetyAlerts,
  getNeighborhoodNews,
};
