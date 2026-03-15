const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_' });
const MAX_FEEDS = 5;
const MAX_PER_FEED = 3;
const MAX_TOTAL = 15;
const FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeFeedUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (/\/feed\/?$/.test(url.pathname) || /\.xml$/i.test(url.pathname) || /rss/i.test(url.pathname)) {
      return url.toString();
    }

    url.pathname = url.pathname.replace(/\/+$/, '') + '/feed';
    return url.toString();
  } catch {
    return null;
  }
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value['#text'] || value._text || value._cdata || '';
  }
  return String(value);
}

function isFresh(pubDate) {
  const timestamp = Date.parse(pubDate || '');
  return !Number.isNaN(timestamp) && (Date.now() - timestamp) <= FRESHNESS_MS;
}

function normalizeEntry(entry, source) {
  const linkValue = entry.link?._href || entry.link?.href || entry.link || entry.guid || '';
  const pubDate = entry.pubDate || entry.published || entry.updated || '';
  return {
    title: getText(entry.title),
    url: getText(linkValue),
    pubDate,
    source,
    platform: 'Newsletter',
    description: getText(entry.description || entry.summary || entry.content).replace(/<[^>]+>/g, '').trim(),
  };
}

async function fetchFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'MyDailyBriefing/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];
    const xml = await response.text();
    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel;
    const feed = parsed?.feed;

    const source = getText(channel?.title || feed?.title) || new URL(feedUrl).hostname;
    const rawItems = toArray(channel?.item || feed?.entry);

    return rawItems
      .map((entry) => normalizeEntry(entry, source))
      .filter((item) => item.title && item.url && isFresh(item.pubDate))
      .slice(0, MAX_PER_FEED);
  } catch (error) {
    console.warn('Newsletter feed fetch failed:', error.message);
    return [];
  }
}

async function getNewsletterFeed(substackUrls = []) {
  const feedUrls = [...new Set(
    substackUrls
      .map(normalizeFeedUrl)
      .filter(Boolean)
  )].slice(0, MAX_FEEDS);

  if (!feedUrls.length) return [];

  const results = await Promise.all(feedUrls.map(fetchFeed));
  return results
    .flat()
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, MAX_TOTAL);
}

module.exports = {
  getNewsletterFeed,
};
