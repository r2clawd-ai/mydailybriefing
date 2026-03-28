/**
 * social.js — Social feed aggregator
 *
 * Sources (no API keys required):
 *   1. Google News per followed X/Twitter handle (articles about them)
 *   2. Reddit JSON API for interest-matched subreddits (real posts, real UA)
 *   3. Truth Social fallback
 */

const fetch   = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const { fixUrl } = require('./url-fix');

const parser  = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_' });
const MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days

// Real browser UA — required for Reddit JSON API
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Interest → top subreddits mapping
const INTEREST_SUBREDDITS = {
  'finance':            ['personalfinance', 'financialindependence'],
  'markets':            ['investing', 'stocks'],
  'crypto':             ['CryptoCurrency', 'Bitcoin'],
  'technology':         ['technology', 'MachineLearning'],
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
  'local news':         ['news'],
  'business':           ['business', 'Entrepreneur'],
};

function normalizeRSSItem(item, platform, handle) {
  const title = item.title?.['#text'] || item.title || '';
  const link  = fixUrl(item.link?._href || item.link || item.guid?.['#text'] || item.guid || '');
  const pub   = item.pubDate || item.published || item.updated || '';
  const desc  = (item.description || item.summary || item.content || '').toString()
    .replace(/<[^>]+>/g, '').trim().slice(0, 200);
  return { title, url: link, pubDate: pub, source: handle, platform, description: desc };
}

function isFresh(item) {
  const pub = Date.parse(item.pubDate || item.created_at || '');
  return isNaN(pub) || (Date.now() - pub) <= MAX_AGE;
}

async function fetchRSS(url, max = 5) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': BROWSER_UA },
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

// ── Reddit JSON API — multi-sub in ONE request ────────────────────
// Use Reddit's multi-sub URL (r/sub1+sub2+sub3) to batch into a single
// HTTP call, avoiding rate limits from parallel individual requests.
async function getRedditFeed(interests) {
  const subs = new Set();
  for (const interest of interests) {
    const key = interest.toLowerCase();
    for (const [k, v] of Object.entries(INTEREST_SUBREDDITS)) {
      if (key.includes(k) || k.includes(key)) v.forEach(s => subs.add(s));
    }
  }
  if (!subs.size) return [];

  // Pick top 5 subs, combine into one URL — one request, no rate limit
  const topSubs = [...subs].slice(0, 5);
  const combined = topSubs.join('+');

  try {
    const res = await fetch(
      `https://www.reddit.com/r/${combined}/hot.json?limit=20&raw_json=1`,
      {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const posts = data?.data?.children || [];
    return posts
      .filter(p => !p.data.stickied && p.data.title && p.data.score > 10)
      .slice(0, 12)
      .map(p => ({
        title:       p.data.title,
        url:         p.data.url.startsWith('http') ? p.data.url : `https://reddit.com${p.data.permalink}`,
        pubDate:     new Date(p.data.created_utc * 1000).toISOString(),
        source:      `r/${p.data.subreddit}`,
        platform:    'Reddit',
        description: p.data.selftext ? p.data.selftext.slice(0, 200) : '',
        score:       p.data.score,
        comments:    p.data.num_comments,
      }))
      .filter(i => i.title && !i.title.toLowerCase().includes('[deleted]'));
  } catch { return []; }
}

// ── X/Twitter handles → Google News (news about them) ────────────
async function getHandleFeed(handles) {
  if (!handles.length) return [];
  const GOOGLE = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const afterDate = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10);
  const results = await Promise.all(
    handles.slice(0, 6).map(async h => {
      const clean = h.replace(/^@/, '');
      const items = await fetchRSS(GOOGLE(`(@${clean} OR "${clean}") after:${afterDate}`), 4);
      return items.map(i => normalizeRSSItem(i, 'X', `@${clean}`));
    })
  );
  return results.flat();
}

// ── Truth Social ──────────────────────────────────────────────────
async function getTruthSocialFeed(handles = []) {
  const cleanHandles = handles.map(h => h.replace(/^@/, '').trim()).filter(Boolean).slice(0, 4);
  if (!cleanHandles.length) return [];
  try {
    const results = await Promise.all(cleanHandles.map(async (handle) => {
      const lookup = await fetch(
        `https://truthsocial.com/api/v2/search?q=${encodeURIComponent(handle)}&resolve=true&type=accounts`,
        { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(7000) }
      );
      if (!lookup.ok) return [];
      const { accounts = [] } = await lookup.json();
      const account = accounts.find(a =>
        (a.acct||'').toLowerCase() === handle.toLowerCase() ||
        (a.username||'').toLowerCase() === handle.toLowerCase()
      ) || accounts[0];
      if (!account?.id) return [];
      const sr = await fetch(
        `https://truthsocial.com/api/v1/accounts/${account.id}/statuses`,
        { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(7000) }
      );
      if (!sr.ok) return [];
      const statuses = await sr.json();
      return (Array.isArray(statuses) ? statuses : []).slice(0, 3).map(s => {
        const text = (s.content || '').replace(/<[^>]+>/g, '').trim();
        return { title: text.slice(0, 120), text, url: s.url, pubDate: s.created_at,
          source: `@${account.acct || handle}`, platform: 'Truth Social', description: text.slice(0, 200) };
      }).filter(i => i.text && isFresh(i));
    }));
    return results.flat();
  } catch { return []; }
}

// ── Main export ───────────────────────────────────────────────────
async function getSocialFeed(handles = [], interests = []) {
  const [handleItems, redditItems, truthItems] = await Promise.all([
    getHandleFeed(handles.map(h => h.replace(/^@/, ''))).catch(() => []),
    getRedditFeed(interests).catch(() => []),
    getTruthSocialFeed(handles).catch(() => []),
  ]);

  const seen = new Set();
  const all = [...handleItems, ...redditItems, ...truthItems].filter(item => {
    const key = (item.title || item.text || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    items: all.slice(0, 25),
    has_handles: handles.length > 0,
    empty: all.length === 0,
  };
}

module.exports = { getSocialFeed, getTruthSocialFeed };
