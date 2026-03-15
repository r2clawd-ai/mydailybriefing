/**
 * social.js — Social feed aggregator
 * 
 * Sources (no API keys required):
 *   1. Google News per followed X/Twitter handle
 *   2. Reddit RSS for interest-matched subreddits
 *   3. Substack RSS if handle looks like a Substack author
 */

const fetch   = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const { fixUrl } = require('./url-fix');

const parser  = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_' });
const MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days

// Interest → top subreddits mapping
const INTEREST_SUBREDDITS = {
  'finance':            ['personalfinance', 'financialindependence'],
  'markets':            ['investing', 'stocks'],
  'crypto':             ['CryptoCurrency', 'Bitcoin'],
  'technology':         ['technology', 'artificial'],
  'ai / tech':          ['MachineLearning', 'artificial'],
  'politics':           ['politics', 'NeutralPolitics'],
  'world news':         ['worldnews'],
  'health':             ['Health', 'nutrition'],
  'sports':             ['sports'],
  'real estate':        ['realestateinvesting', 'realestate'],
  'science':            ['science', 'EverythingScience'],
  'entertainment':      ['entertainment', 'movies'],
  'behavioral finance': ['BehavioralEconomics', 'investing'],
  'philosophy':         ['philosophy', 'Stoicism'],
  'stoicism':           ['Stoicism'],
};

async function fetchRSS(url, max = 5) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MDB/1.0; +https://mydailybriefing.app)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const doc = parser.parse(xml);
    const channel = doc?.rss?.channel || doc?.feed;
    if (!channel) return [];
    const items = channel.item || channel.entry || [];
    return (Array.isArray(items) ? items : [items]).slice(0, max);
  } catch { return []; }
}

function normalizeItem(item, platform, handle) {
  const title = item.title?.['#text'] || item.title || '';
  const link  = fixUrl(item.link?._href || item.link || item.guid?.['#text'] || item.guid || '');
  const pub   = item.pubDate || item.published || item.updated || '';
  const desc  = (item.description || item.summary || item.content || '').toString()
    .replace(/<[^>]+>/g, '').trim().slice(0, 200);
  return { title, url: link, pubDate: pub, source: handle, platform, description: desc };
}

function isFresh(item) {
  const pub = Date.parse(item.pubDate || '');
  return isNaN(pub) || (Date.now() - pub) <= MAX_AGE;
}

// ── X/Twitter handles → Google News ──────────────────────────────
async function getHandleFeed(handles) {
  if (!handles.length) return [];
  // `when:7d` restricts to last 7 days so we get fresh articles, not top-all-time
  const GOOGLE = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const afterDate = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10); // YYYY-MM-DD
  const results = await Promise.all(
    handles.slice(0, 6).map(async h => {
      const clean = h.replace(/^@/, '');
      const items = await fetchRSS(GOOGLE(`(@${clean} OR "${clean}") after:${afterDate}`), 4);
      return items.map(i => normalizeItem(i, 'X', `@${clean}`));
    })
  );
  return results.flat();
}

// ── Reddit via Google News ────────────────────────────────────────
// Reddit blocks server-side RSS; use Google News search for site:reddit.com instead
async function getRedditFeed(interests) {
  const subs = new Set();
  for (const interest of interests) {
    const key = interest.toLowerCase();
    for (const [k, v] of Object.entries(INTEREST_SUBREDDITS)) {
      if (key.includes(k) || k.includes(key)) v.forEach(s => subs.add(s));
    }
  }
  if (!subs.size) return [];

  const GOOGLE = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const afterDate = new Date(Date.now() - 2*24*60*60*1000).toISOString().slice(0,10); // YYYY-MM-DD
  const topSubs = [...subs].slice(0, 3);

  const results = await Promise.all(
    topSubs.map(async sub => {
      const items = await fetchRSS(GOOGLE(`site:reddit.com/r/${sub} after:${afterDate}`), 3);
      return items
        .map(i => normalizeItem(i, 'Reddit', `r/${sub}`))
        .filter(i => i.title && !i.title.toLowerCase().includes('[deleted]'));
    })
  );
  return results.flat();
}

async function getTruthSocialFeed(handles = []) {
  const cleanHandles = handles
    .map((handle) => handle.replace(/^@/, '').trim())
    .filter(Boolean)
    .slice(0, 4);

  if (!cleanHandles.length) return [];

  try {
    const results = await Promise.all(cleanHandles.map(async (handle) => {
      const lookupUrl = `https://truthsocial.com/api/v2/search?q=${encodeURIComponent(handle)}&resolve=true&type=accounts`;
      const lookupResponse = await fetch(lookupUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MDB/1.0; +https://mydailybriefing.app)' },
        signal: AbortSignal.timeout(7000),
      });

      if (!lookupResponse.ok) {
        if (lookupResponse.status === 403) return [];
        throw new Error(`Truth Social lookup failed with status ${lookupResponse.status}`);
      }

      const lookupPayload = await lookupResponse.json();
      const account = (lookupPayload.accounts || []).find((item) => {
        const acct = (item.acct || '').replace(/^@/, '').toLowerCase();
        const username = (item.username || '').replace(/^@/, '').toLowerCase();
        return acct === handle.toLowerCase() || username === handle.toLowerCase();
      }) || lookupPayload.accounts?.[0];

      if (!account?.id) return [];

      const statusResponse = await fetch(`https://truthsocial.com/api/v1/accounts/${account.id}/statuses`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MDB/1.0; +https://mydailybriefing.app)' },
        signal: AbortSignal.timeout(7000),
      });

      if (!statusResponse.ok) {
        if (statusResponse.status === 403) return [];
        throw new Error(`Truth Social status fetch failed with status ${statusResponse.status}`);
      }

      const statuses = await statusResponse.json();
      return (Array.isArray(statuses) ? statuses : []).slice(0, 3).map((status) => {
        const text = (status.content || '').replace(/<[^>]+>/g, '').trim();
        return {
          title: text.slice(0, 120),
          text,
          url: status.url,
          pubDate: status.created_at,
          source: `@${account.acct || account.username || handle}`,
          platform: 'Truth Social',
          description: text.slice(0, 200),
        };
      }).filter((item) => item.text && isFresh(item));
    }));

    return results.flat();
  } catch (error) {
    console.warn('Truth Social fetch failed:', error.message);
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────
async function getSocialFeed(handles = [], interests = []) {
  const [handleItems, redditItems, truthItems] = await Promise.all([
    getHandleFeed(handles.map(h => h.replace(/^@/, ''))).catch(() => []),
    getRedditFeed(interests).catch(() => []),
    getTruthSocialFeed(handles).catch(() => []),
  ]);

  // Dedup by title
  const seen = new Set();
  const all = [...handleItems, ...redditItems, ...truthItems].filter(item => {
    const key = (item.title || item.text || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    items: all.slice(0, 20),
    has_handles: handles.length > 0,
    empty: all.length === 0,
  };
}

module.exports = { getSocialFeed, getTruthSocialFeed };
