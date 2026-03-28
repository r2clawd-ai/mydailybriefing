/**
 * content.js - Parameterized content engine
 * All functions fail gracefully (return empty array/object) rather than throwing.
 */

const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const { exec } = require('child_process');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ---------- RSS helpers ----------

const GOOGLE_NEWS_RSS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

const NPR_RSS = 'https://feeds.npr.org/1001/rss.xml';
const LOCAL_TV_RSS = {
  AZ: 'https://www.abc15.com/news/region-phoenix-metro/rss',
  CA: 'https://ktla.com/feed/',
  CO: 'https://kdvr.com/feed/',
  FL: 'https://www.local10.com/arc/outboundfeeds/rss/category/news/',
  GA: 'https://www.11alive.com/feeds/syndication/rss/news/local/',
  IL: 'https://wgntv.com/feed/',
  IN: 'https://fox59.com/feed/',
  MA: 'https://www.wcvb.com/local-news-rss',
  MD: 'https://www.wbaltv.com/local-news-rss',
  MI: 'https://www.clickondetroit.com/arc/outboundfeeds/rss/category/news/local/',
  MO: 'https://fox2now.com/feed/',
  NC: 'https://www.wsoctv.com/rss/local-news',
  NJ: 'https://newjersey.news12.com/feed',
  NY: 'https://pix11.com/feed/',
  OH: 'https://www.cleveland19.com/rss/',
  PA: 'https://www.cbsnews.com/pittsburgh/latest/rss/main',
  SD: 'https://www.keloland.com/news/local-news/feed/',
  TN: 'https://www.wkrn.com/feed/',
  TX: 'https://www.wfaa.com/feeds/syndication/rss/local/',
  VA: 'https://www.wtvr.com/news/local-news/rss',
  WA: 'https://www.king5.com/feeds/syndication/rss/local/',
  WI: 'https://www.tmj4.com/news/local-news/rss',
};

async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BriefingApp/1.0' },
      timeout: 8000,
    });
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = parser.parse(text);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
  } catch (e) {
    console.warn(`RSS fetch failed (${url}):`, e.message);
    return [];
  }
}

function fixUrl(url) {
  if (!url) return '';
  // Google News RSS redirect → direct article URL (works on all browsers/mobile)
  return url.replace('news.google.com/rss/articles/', 'news.google.com/articles/');
}

function normalizeItem(item) {
  const url = fixUrl(item.link || item.guid || item.url || '');
  return {
    title:       item.title       || '',
    url,
    link:        url,   // keep for backward compat
    source:      item.source?.['#text'] || item.source || item['dc:creator'] || '',
    pubDate:     item.pubDate     || item['dc:date'] || item.published || '',
    published:   item.pubDate     || item['dc:date'] || item.published || '',
    description: item.description ? stripHTML(item.description).slice(0, 200) : '',
  };
}

module.exports.fixUrl = fixUrl;

function normalizeState(state = '') {
  const input = String(state).trim();
  const upper = input.toUpperCase();
  if (LOCAL_TV_RSS[upper]) return upper;

  const stateMap = {
    ARIZONA: 'AZ',
    CALIFORNIA: 'CA',
    COLORADO: 'CO',
    FLORIDA: 'FL',
    GEORGIA: 'GA',
    ILLINOIS: 'IL',
    INDIANA: 'IN',
    MASSACHUSETTS: 'MA',
    MARYLAND: 'MD',
    MICHIGAN: 'MI',
    MISSOURI: 'MO',
    'NORTH CAROLINA': 'NC',
    'NEW JERSEY': 'NJ',
    'NEW YORK': 'NY',
    OHIO: 'OH',
    PENNSYLVANIA: 'PA',
    'SOUTH DAKOTA': 'SD',
    TENNESSEE: 'TN',
    TEXAS: 'TX',
    VIRGINIA: 'VA',
    WASHINGTON: 'WA',
    WISCONSIN: 'WI',
  };

  return stateMap[upper.replace(/\./g, '').replace(/\s+/g, ' ')] || null;
}

function stripHTML(str) {
  return String(str).replace(/<[^>]*>/g, '').trim();
}

// Stop words to ignore when comparing titles
const STOP = new Set(['a','an','the','in','on','at','to','for','of','and','or','but',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','with','from','by','about','as',
  'into','through','during','before','after','above','below','up','down','out',
  'off','over','under','again','then','once','here','there','when','where','why',
  'how','all','both','each','few','more','most','other','some','such','than','too',
  'very','just','not','its','it','this','that','these','those','new','says','said']);

function titleWords(title) {
  return (title || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

function bigrams(words) {
  const bg = new Set();
  for (let i = 0; i < words.length - 1; i++) bg.add(`${words[i]}|${words[i+1]}`);
  return bg;
}

// Extract capitalized multi-word entities from raw title (e.g. "Top Hat", "Sioux Falls")
function properNouns(rawTitle) {
  const tokens = (rawTitle || '').replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const entities = new Set();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i], b = tokens[i + 1];
    // Both words capitalized, neither is a sentence-start stop word
    if (/^[A-Z]/.test(a) && /^[A-Z]/.test(b) && a.length > 2 && b.length > 2) {
      entities.add(`${a.toLowerCase()} ${b.toLowerCase()}`);
    }
  }
  return entities;
}

function similarity(a, b) {
  const wa = titleWords(a);
  const wb = titleWords(b);
  if (!wa.length || !wb.length) return 0;

  // Unigram overlap
  const sa = new Set(wa), sb = new Set(wb);
  let uniOverlap = 0;
  sa.forEach(w => { if (sb.has(w)) uniOverlap++; });
  const uniScore = uniOverlap / Math.min(sa.size, sb.size);

  // Bigram overlap
  const ba = bigrams(wa), bb = bigrams(wb);
  let biOverlap = 0;
  ba.forEach(g => { if (bb.has(g)) biOverlap++; });
  const biScore = ba.size && bb.size ? biOverlap / Math.min(ba.size, bb.size) : 0;

  // Proper-noun entity match — shared capitalized phrase = almost certainly same story
  const pa = properNouns(a), pb = properNouns(b);
  let pnMatch = 0;
  pa.forEach(e => { if (pb.has(e)) pnMatch++; });
  // One shared proper-noun entity + any word overlap = likely same story
  const pnScore = pnMatch > 0 && uniOverlap > 0 ? 0.6 : 0;

  return Math.max(uniScore, biScore * 1.4, pnScore);
}

function dedup(articles, threshold = 0.55) {
  const kept = [];
  for (const a of articles) {
    const isDupe = kept.some(k => similarity(k.title, a.title) >= threshold);
    if (!isDupe) kept.push(a);
  }
  return kept;
}

// Cross-array dedup: remove from `incoming` anything too similar to already-seen titles
function dedupAgainst(incoming, seen, threshold = 0.5) {
  return incoming.filter(a => !seen.some(s => similarity(s.title, a.title) >= threshold));
}

function localNewsScore(item, city, state) {
  const title = (item.title || '').toLowerCase();
  const description = (item.description || '').toLowerCase();
  const source = (typeof item.source === 'string' ? item.source : item.source?.['#text'] || item.source?.title || '').toLowerCase();
  const cityLower = String(city || '').toLowerCase();
  const stateLower = String(state || '').toLowerCase();
  let score = 0;

  if (item.source_type === 'local_tv') score += 4;
  if (cityLower && (title.includes(cityLower) || description.includes(cityLower) || source.includes(cityLower))) score += 3;
  if (stateLower && (title.includes(stateLower) || description.includes(stateLower) || source.includes(stateLower))) score += 1;
  if (title.includes('breaking')) score += 0.5;

  const published = Date.parse(item.published || '');
  if (!Number.isNaN(published)) {
    const ageHours = Math.max(0, (Date.now() - published) / 36e5);
    score += Math.max(0, 2 - Math.min(ageHours / 12, 2));
  }

  return score;
}

// ---------- Public API ----------

/**
 * Get NWS weather forecast for lat/lng.
 */
async function getWeather(lat, lng, nwsGrid = null) {
  try {
    let forecastUrl;
    if (nwsGrid?.forecastUrl) {
      forecastUrl = nwsGrid.forecastUrl;
    } else {
      // Discover grid first
      const ptRes = await fetch(
        `https://api.weather.gov/points/${lat},${lng}`,
        { headers: { 'User-Agent': 'BriefingApp/1.0' } }
      );
      if (!ptRes.ok) return null;
      const ptData = await ptRes.json();
      forecastUrl = ptData.properties.forecast;
    }

    const fcRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': 'BriefingApp/1.0' },
    });
    if (!fcRes.ok) return null;
    const fcData = await fcRes.json();
    const periods = fcData.properties.periods || [];

    return {
      current:  periods[0]  || null,
      tonight:  periods[1]  || null,
      tomorrow: periods[2]  || null,
      periods:  periods.slice(0, 6),
    };
  } catch (e) {
    console.warn('Weather fetch error:', e.message);
    return null;
  }
}

/**
 * Get local news for a city/state via Google News RSS.
 * Returns top 5 articles.
 */
async function getLocalNews(city, state) {
  try {
    const tvFeed = LOCAL_TV_RSS[normalizeState(state)];
    const [r1, r2, tvItems] = await Promise.all([
      fetchRSS(GOOGLE_NEWS_RSS(`${city} ${state} news`)).catch(() => []),
      fetchRSS(GOOGLE_NEWS_RSS(`${city} ${state} local`)).catch(() => []),
      tvFeed ? fetchRSS(tvFeed).catch(() => []) : Promise.resolve([]),
    ]);

    const normalizedGoogle = [...r1, ...r2].map(normalizeItem).map(item => ({
      ...item,
      source_type: 'google_news',
    }));
    const normalizedTv = tvItems.map(normalizeItem).map(item => ({
      ...item,
      source_type: 'local_tv',
      source: item.source || tvFeed,
    }));

    // Hard age cap: local news must be ≤ 7 days old
    const MAX_LOCAL_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const fresh = dedup([...normalizedTv, ...normalizedGoogle], 0.45).filter(item => {
      const pub = Date.parse(item.published || '');
      return isNaN(pub) || (Date.now() - pub) <= MAX_LOCAL_AGE_MS;
    });
    return fresh
      .sort((a, b) => localNewsScore(b, city, state) - localNewsScore(a, city, state))
      .slice(0, 6)
      .map(({ source_type, ...item }) => item);
  } catch (e) {
    console.warn('Local news error:', e.message);
    return [];
  }
}

/**
 * Get national news from NPR RSS.
 * Returns top 8 articles.
 */
async function getNationalNews() {
  try {
    const items = await fetchRSS(NPR_RSS);
    return dedup(items.slice(0, 8).map(normalizeItem));
  } catch (e) {
    console.warn('National news error:', e.message);
    return [];
  }
}

/**
 * Get sports news for an array of team names.
 * Deduplicates across teams, top 2 per team, max 10 total.
 */
async function getSportsNews(teams = []) {
  try {
    const allItems = [];
    if (teams.length) {
      for (const team of teams.slice(0, 5)) {
        const items = await fetchRSS(GOOGLE_NEWS_RSS(`${team} sports`));
        allItems.push(...items.slice(0, 2).map(normalizeItem));
      }
    } else {
      // Default: top sports headlines
      const items = await fetchRSS(GOOGLE_NEWS_RSS('sports news today'));
      allItems.push(...items.slice(0, 6).map(normalizeItem));
    }
    return dedup(allItems).slice(0, 10);
  } catch (e) {
    console.warn('Sports news error:', e.message);
    return [];
  }
}

/**
 * Get topic news for an array of interest strings.
 * Returns top 2 per topic, max 12 total, deduplicated.
 */
async function getTopicNews(interests = []) {
  if (!interests.length) return [];
  try {
    const allItems = [];
    for (const topic of interests.slice(0, 6)) {
      const items = await fetchRSS(GOOGLE_NEWS_RSS(topic));
      allItems.push(...items.slice(0, 2).map(normalizeItem));
    }
    return dedup(allItems).slice(0, 12);
  } catch (e) {
    console.warn('Topic news error:', e.message);
    return [];
  }
}

/**
 * Get market data for an array of stock tickers via yahoo-finance2 (pure Node).
 */
async function getMarkets(stocks = ['SPY', 'QQQ', 'BTC-USD']) {
  let yf;
  try {
    const mod = require('yahoo-finance2');
    const YF = mod.default;
    yf = new YF({ suppressNotices: ['yahooSurvey'] });
  } catch(e) { return []; }
  const tickers = (stocks.length ? stocks : ['SPY', 'QQQ', 'BTC-USD']).map(s => s.trim());
  const results = [];
  for (const sym of tickers) {
    try {
      const q = await yf.quote(sym, {}, { validateResult: false });
      const price = q.regularMarketPrice ?? q.currentPrice ?? null;
      const prev  = q.regularMarketPreviousClose ?? price;
      if (price === null) continue;
      const chg = price - prev;
      const pct = prev ? (chg / prev * 100) : 0;
      results.push({
        symbol: sym,
        price:      Math.round(price * 10000) / 10000,
        change:     Math.round(chg   * 10000) / 10000,
        change_pct: Math.round(pct   * 100)   / 100,
        direction:  chg >= 0 ? 'up' : 'down',
      });
    } catch(e) {
      console.warn(`Markets fetch error for ${sym}:`, e.message);
    }
  }
  return results;
}

module.exports = { getWeather, getLocalNews, getNationalNews, getSportsNews, getTopicNews, getMarkets, dedupAgainst, dedup, LOCAL_TV_RSS };

/**
 * Generate actionable weather summary line.
 * e.g. "Thunderstorms 3–5 PM — bring an umbrella"
 */
function getWeatherAction(period) {
  if (!period) return null;
  const forecast = (period.detailedForecast || period.shortForecast || '').toLowerCase();
  const temp = period.temperature || 0;
  const unit = period.temperatureUnit || 'F';

  const actions = [];

  if (/thunder|lightning|storm/.test(forecast))    actions.push('⛈ Storms expected — plan around them');
  else if (/snow|blizzard|flurr/.test(forecast))   actions.push('🌨 Snow — give yourself extra drive time');
  else if (/freezing|ice|sleet/.test(forecast))    actions.push('🧊 Icy conditions — drive carefully');
  else if (/rain|shower|drizzle/.test(forecast))   actions.push('🌧 Bring an umbrella');
  else if (/fog/.test(forecast))                   actions.push('🌫 Dense fog — slow down');
  else if (/wind|breezy|windy/.test(forecast))     actions.push('💨 Windy — secure outdoor items');
  else if (/sunny|clear|fair/.test(forecast)) {
    if ((unit === 'F' && temp >= 70) || (unit === 'C' && temp >= 21))
      actions.push('☀️ Great day to be outside');
    else
      actions.push('☀️ Clear skies');
  } else if (/cloud/.test(forecast))               actions.push('⛅ Cloudy but dry');

  // Cold/hot advisories
  if (unit === 'F') {
    if (temp <= 10)       actions.push('🥶 Dangerous cold — limit time outdoors');
    else if (temp <= 25)  actions.push('🧣 Bundle up — well below freezing');
    else if (temp <= 40)  actions.push('🧥 Heavy coat weather');
    else if (temp >= 95)  actions.push('🌡 Heat advisory — stay hydrated');
    else if (temp >= 85)  actions.push('🌡 Hot — wear sunscreen');
  }

  return actions.length ? actions.join(' · ') : null;
}

module.exports.getWeatherAction = getWeatherAction;

/**
 * Get news feed for followed X/Twitter handles.
 * Uses Google News search per handle — no API key required.
 * Returns up to 3 items per handle, max 15 total, deduped.
 */
async function getFollowFeed(handles = []) {
  if (!handles.length) return [];

  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  const results = await Promise.all(
    handles.slice(0, 5).map(async (handle) => {
      try {
        const items = await fetchRSS(GOOGLE_NEWS_RSS(`@${handle} OR "${handle}"`));
        return items
          .map(normalizeItem)
          .filter(item => {
            const pub = Date.parse(item.published || '');
            return isNaN(pub) || (Date.now() - pub) <= MAX_AGE_MS;
          })
          .slice(0, 3)
          .map(item => ({ ...item, follow_handle: handle }));
      } catch { return []; }
    })
  );

  const flat = results.flat();
  const seen = new Set();
  return flat.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 15);
}

module.exports.getFollowFeed = getFollowFeed;
