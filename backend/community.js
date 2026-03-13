/**
 * community.js — The heart of the paper.
 * Obituaries, memorials, community announcements, milestones, church news.
 * This is what made a newspaper feel like a community, not a feed.
 */

const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyDailyBriefing/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml  = await res.text();
    const data = parser.parse(xml);
    const items = data?.rss?.channel?.item || data?.feed?.entry || [];
    return Array.isArray(items) ? items : [items];
  } catch { return []; }
}

function gnNews(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function parseItem(it) {
  return {
    title:   (it.title?.['#text'] || it.title || '').replace(/<[^>]+>/g, '').trim(),
    url:     it.link?.href || it.link || it.guid?.['#text'] || it.guid || '',
    source:  it.source?.['#text'] || it.source || '',
    pubDate: it.pubDate || it.published || it.updated || '',
  };
}

function cleanObituaryTitle(title = '', source = '') {
  let cleaned = String(title)
    .replace(/^obituary\s*[|:-]\s*/i, '')
    .replace(/^obituaries\s*[|:-]\s*/i, '')
    .replace(/\s+[|:-]\s+obituary$/i, '')
    .trim();

  if (source) {
    const escapedSource = String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\s*[|:-]\\s*${escapedSource}\\s*$`, 'i'), '').trim();
  }

  cleaned = cleaned
    .replace(/\s*[|:-]\s*(funeral home|chapel|mortuary|memorial chapel|memorial park)\b.*$/i, '')
    .replace(/\s+[|:-]\s+[A-Z][A-Za-z.'& ]{2,50}$/g, '')
    .replace(/\b(obituary|obit|passed away|memorial service|funeral service)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const nameMatch = cleaned.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,4})/);
  return nameMatch ? nameMatch[1].trim() : cleaned;
}

// ── Obituaries ────────────────────────────────────────────────────────────────
// Uses Google News to surface real obituaries from local funeral homes & papers.
async function getObituaries(city, state) {
  const queries = [
    `"${city}" obituary`,
    `"${city}" "passed away" OR "memorial service"`,
    `"${city}" funeral home obituary`,
  ];

  const results = await Promise.all(
    queries.map(q => fetchRSS(gnNews(q)))
  );

  const seen  = new Set();
  const items = [];

  for (const list of results) {
    for (const it of list) {
      const parsed = parseItem(it);
      if (!parsed.title || seen.has(parsed.title)) continue;

      // Filter to actual obituaries — skip funeral home ads, service listings
      const t = parsed.title.toLowerCase();
      const isObit = t.includes('obituary') || t.includes('obit') ||
                     t.includes('passed away') || t.includes('in memory') ||
                     t.includes('memorial') || t.includes('in loving memory') ||
                     t.includes('funeral') || (t.includes('age') && (t.includes('died') || t.includes('death')));
      if (!isObit) continue;

      seen.add(parsed.title);
      const headline = cleanObituaryTitle(parsed.title, parsed.source);
      if (!headline) continue;
      items.push({
        ...parsed,
        title: headline,
        type: 'obituary',
        source: parsed.source || 'Google News',
      });
      if (items.length >= 6) break;
    }
    if (items.length >= 6) break;
  }

  return items;
}

// ── Community Announcements ───────────────────────────────────────────────────
// Weddings, engagements, births, graduations, awards, milestones.
async function getAnnouncements(city, state) {
  const queries = [
    `"${city}" engagement OR wedding announcement`,
    `"${city}" graduation honor roll award achievement`,
    `"${city}" new baby born OR birth announcement`,
    `"${city}" anniversary milestone celebration community`,
  ];

  const results = await Promise.all(
    queries.map(q => fetchRSS(gnNews(q)))
  );

  const seen  = new Set();
  const items = [];

  for (const list of results) {
    for (const it of list) {
      const parsed = parseItem(it);
      if (!parsed.title || seen.has(parsed.title)) continue;

      const t = parsed.title.toLowerCase();
      // Skip pure news stories, keep personal/community items
      const skip = t.includes('stock') || t.includes('market') || t.includes('senate') ||
                   t.includes('trump') || t.includes('biden') || t.includes('police') ||
                   t.includes('shooting') || t.includes('crash');
      if (skip) continue;

      seen.add(parsed.title);
      items.push({ ...parsed, type: 'announcement' });
      if (items.length >= 4) break;
    }
    if (items.length >= 4) break;
  }

  return items;
}

// ── Faith & Community ─────────────────────────────────────────────────────────
// Church news, faith community events, local nonprofit highlights.
async function getFaithCommunity(city, state) {
  const queries = [
    `"${city}" church event OR service OR community ministry`,
    `"${city}" nonprofit volunteer community drive`,
    `"${city}" food bank OR shelter OR charity event`,
  ];

  const results = await Promise.all(
    queries.slice(0, 2).map(q => fetchRSS(gnNews(q)))
  );

  const seen  = new Set();
  const items = [];

  for (const list of results) {
    for (const it of list) {
      const parsed = parseItem(it);
      if (!parsed.title || seen.has(parsed.title)) continue;

      const t = parsed.title.toLowerCase();
      const isCommunity = t.includes('church') || t.includes('faith') ||
                          t.includes('ministry') || t.includes('nonprofit') ||
                          t.includes('volunteer') || t.includes('food bank') ||
                          t.includes('shelter') || t.includes('community') ||
                          t.includes('charity') || t.includes('donation');
      if (!isCommunity) continue;

      seen.add(parsed.title);
      items.push({ ...parsed, type: 'community' });
      if (items.length >= 4) break;
    }
    if (items.length >= 4) break;
  }

  return items;
}

// ── Local Milestones ──────────────────────────────────────────────────────────
// Businesses celebrating anniversaries, buildings turning 100, local records.
async function getMilestones(city, state) {
  const items = await fetchRSS(
    gnNews(`"${city}" anniversary OR milestone OR "years in business" OR centennial OR "years old"`)
  );

  const seen   = new Set();
  const result = [];

  for (const it of items) {
    const parsed = parseItem(it);
    if (!parsed.title || seen.has(parsed.title)) continue;

    const t = parsed.title.toLowerCase();
    const isMilestone = t.includes('anniversary') || t.includes('years') ||
                        t.includes('milestone') || t.includes('centennial') ||
                        t.includes('founded') || t.includes('celebrating');
    if (!isMilestone) continue;

    // Must mention the city
    if (!parsed.title.toLowerCase().includes(city.toLowerCase()) &&
        !parsed.source.toLowerCase().includes(city.toLowerCase())) continue;

    seen.add(parsed.title);
    result.push({ ...parsed, type: 'milestone' });
    if (result.length >= 3) break;
  }

  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────
async function getCommunity({ city, state }) {
  if (!city) return { obituaries: [], announcements: [], faith: [], milestones: [] };

  const [obituaries, announcements, faith, milestones] = await Promise.allSettled([
    getObituaries(city, state),
    getAnnouncements(city, state),
    getFaithCommunity(city, state),
    getMilestones(city, state),
  ]);

  return {
    obituaries:    obituaries.status    === 'fulfilled' ? obituaries.value    : [],
    announcements: announcements.status === 'fulfilled' ? announcements.value : [],
    faith:         faith.status         === 'fulfilled' ? faith.value         : [],
    milestones:    milestones.status    === 'fulfilled' ? milestones.value    : [],
  };
}

module.exports = { getCommunity };
