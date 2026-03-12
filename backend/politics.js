/**
 * politics.js
 * Federal + state + local political context by ZIP code.
 *
 * Sources (all free, no API keys):
 *  - Federal reps: whoismyrepresentative.com (ZIP → senators + rep)
 *  - Federal news: Google News RSS per rep name
 *  - State politics: Google News RSS (governor + legislature + bills)
 *  - Governor lookup: static state→governor map (updated periodically)
 *  - County politics: Google News RSS
 */

const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ─────────────────────────────────────────────────────────────────
// STATE DATA  (governor + legislature names for Google News queries)
// Updated March 2026
// ─────────────────────────────────────────────────────────────────
const STATE_DATA = {
  AL: { name: 'Alabama',        governor: 'Kay Ivey',          legislature: 'Alabama Legislature', party: 'R' },
  AK: { name: 'Alaska',         governor: 'Mike Dunleavy',     legislature: 'Alaska Legislature',  party: 'R' },
  AZ: { name: 'Arizona',        governor: 'Katie Hobbs',        legislature: 'Arizona Legislature', party: 'D' },
  AR: { name: 'Arkansas',       governor: 'Sarah Huckabee Sanders', legislature: 'Arkansas Legislature', party: 'R' },
  CA: { name: 'California',     governor: 'Gavin Newsom',      legislature: 'California Legislature', party: 'D' },
  CO: { name: 'Colorado',       governor: 'Jared Polis',       legislature: 'Colorado Legislature', party: 'D' },
  CT: { name: 'Connecticut',    governor: 'Ned Lamont',        legislature: 'Connecticut Legislature', party: 'D' },
  DE: { name: 'Delaware',       governor: 'Matt Meyer',        legislature: 'Delaware Legislature', party: 'D' },
  FL: { name: 'Florida',        governor: 'Ron DeSantis',      legislature: 'Florida Legislature', party: 'R' },
  GA: { name: 'Georgia',        governor: 'Brian Kemp',        legislature: 'Georgia Legislature', party: 'R' },
  HI: { name: 'Hawaii',         governor: 'Josh Green',        legislature: 'Hawaii Legislature', party: 'D' },
  ID: { name: 'Idaho',          governor: 'Brad Little',       legislature: 'Idaho Legislature', party: 'R' },
  IL: { name: 'Illinois',       governor: 'JB Pritzker',       legislature: 'Illinois Legislature', party: 'D' },
  IN: { name: 'Indiana',        governor: 'Mike Braun',        legislature: 'Indiana Legislature', party: 'R' },
  IA: { name: 'Iowa',           governor: 'Kim Reynolds',      legislature: 'Iowa Legislature', party: 'R' },
  KS: { name: 'Kansas',         governor: 'Laura Kelly',       legislature: 'Kansas Legislature', party: 'D' },
  KY: { name: 'Kentucky',       governor: 'Andy Beshear',      legislature: 'Kentucky Legislature', party: 'D' },
  LA: { name: 'Louisiana',      governor: 'Jeff Landry',       legislature: 'Louisiana Legislature', party: 'R' },
  ME: { name: 'Maine',          governor: 'Janet Mills',       legislature: 'Maine Legislature', party: 'D' },
  MD: { name: 'Maryland',       governor: 'Wes Moore',         legislature: 'Maryland Legislature', party: 'D' },
  MA: { name: 'Massachusetts',  governor: 'Maura Healey',      legislature: 'Massachusetts Legislature', party: 'D' },
  MI: { name: 'Michigan',       governor: 'Gretchen Whitmer',  legislature: 'Michigan Legislature', party: 'D' },
  MN: { name: 'Minnesota',      governor: 'Tim Walz',          legislature: 'Minnesota Legislature', party: 'D' },
  MS: { name: 'Mississippi',    governor: 'Tate Reeves',       legislature: 'Mississippi Legislature', party: 'R' },
  MO: { name: 'Missouri',       governor: 'Mike Kehoe',        legislature: 'Missouri Legislature', party: 'R' },
  MT: { name: 'Montana',        governor: 'Greg Gianforte',    legislature: 'Montana Legislature', party: 'R' },
  NE: { name: 'Nebraska',       governor: 'Jim Pillen',        legislature: 'Nebraska Legislature', party: 'R' },
  NV: { name: 'Nevada',         governor: 'Joe Lombardo',      legislature: 'Nevada Legislature', party: 'R' },
  NH: { name: 'New Hampshire',  governor: 'Kelly Ayotte',      legislature: 'New Hampshire Legislature', party: 'R' },
  NJ: { name: 'New Jersey',     governor: 'Phil Murphy',       legislature: 'New Jersey Legislature', party: 'D' },
  NM: { name: 'New Mexico',     governor: 'Michelle Lujan Grisham', legislature: 'New Mexico Legislature', party: 'D' },
  NY: { name: 'New York',       governor: 'Kathy Hochul',      legislature: 'New York Legislature', party: 'D' },
  NC: { name: 'North Carolina', governor: 'Josh Stein',        legislature: 'North Carolina Legislature', party: 'D' },
  ND: { name: 'North Dakota',   governor: 'Kelly Armstrong',   legislature: 'North Dakota Legislature', party: 'R' },
  OH: { name: 'Ohio',           governor: 'Mike DeWine',       legislature: 'Ohio Legislature', party: 'R' },
  OK: { name: 'Oklahoma',       governor: 'Kevin Stitt',       legislature: 'Oklahoma Legislature', party: 'R' },
  OR: { name: 'Oregon',         governor: 'Tina Kotek',        legislature: 'Oregon Legislature', party: 'D' },
  PA: { name: 'Pennsylvania',   governor: 'Josh Shapiro',      legislature: 'Pennsylvania Legislature', party: 'D' },
  RI: { name: 'Rhode Island',   governor: 'Dan McKee',         legislature: 'Rhode Island Legislature', party: 'D' },
  SC: { name: 'South Carolina', governor: 'Henry McMaster',    legislature: 'South Carolina Legislature', party: 'R' },
  SD: { name: 'South Dakota',   governor: 'Larry Rhoden',      legislature: 'South Dakota Legislature', party: 'R' },
  TN: { name: 'Tennessee',      governor: 'Bill Lee',          legislature: 'Tennessee Legislature', party: 'R' },
  TX: { name: 'Texas',          governor: 'Greg Abbott',       legislature: 'Texas Legislature', party: 'R' },
  UT: { name: 'Utah',           governor: 'Spencer Cox',       legislature: 'Utah Legislature', party: 'R' },
  VT: { name: 'Vermont',        governor: 'Phil Scott',        legislature: 'Vermont Legislature', party: 'R' },
  VA: { name: 'Virginia',       governor: 'Glenn Youngkin',    legislature: 'Virginia Legislature', party: 'R' },
  WA: { name: 'Washington',     governor: 'Bob Ferguson',      legislature: 'Washington Legislature', party: 'D' },
  WV: { name: 'West Virginia',  governor: 'Patrick Morrisey',  legislature: 'West Virginia Legislature', party: 'R' },
  WI: { name: 'Wisconsin',      governor: 'Tony Evers',        legislature: 'Wisconsin Legislature', party: 'D' },
  WY: { name: 'Wyoming',        governor: 'Mark Gordon',       legislature: 'Wyoming Legislature', party: 'R' },
  DC: { name: 'Washington DC',  governor: 'Muriel Bowser',     legislature: 'DC Council', party: 'D' },
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const GOOGLE_NEWS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

async function fetchRSS(url, maxItems = 4) {
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
    if (!res.ok) return [];
    const text   = await res.text();
    const parsed = parser.parse(text);
    const items  = parsed?.rss?.channel?.item;
    const arr    = Array.isArray(items) ? items : (items ? [items] : []);
    return arr.slice(0, maxItems).map(i => ({
      title:   (i.title  || '').replace(/\s*-\s*[^-]{2,40}$/, '').trim(),
      url:     i.link    || i.guid || '',
      source:  i.source?.['#text'] || '',
      pubDate: i.pubDate || '',
    }));
  } catch (e) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// FEDERAL REPRESENTATIVES by ZIP
// ─────────────────────────────────────────────────────────────────
const repCache = new Map();

async function getFederalReps(zip) {
  if (repCache.has(zip)) return repCache.get(zip);
  try {
    const res = await fetch(
      `https://whoismyrepresentative.com/getall_mems.php?zip=${zip}&output=json`,
      { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const reps = (data.results || []).map(r => ({
      name:     r.name,
      party:    r.party,
      state:    r.state,
      district: r.district || null,
      phone:    r.phone,
      office:   r.office,
      url:      r.link,
      chamber:  r.district ? 'House' : 'Senate',
    }));
    // Deduplicate (API sometimes returns senator twice)
    const seen = new Set();
    const deduped = reps.filter(r => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
    repCache.set(zip, deduped);
    return deduped;
  } catch (e) {
    console.warn('Federal reps lookup failed:', e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// FEDERAL NEWS — latest news about your specific reps
// ─────────────────────────────────────────────────────────────────
async function getFederalRepNews(reps, maxItems = 3) {
  if (!reps.length) return [];
  try {
    // Build a query from rep names
    const names = [...new Set(reps.map(r => r.name.split(',')[0].trim()))].slice(0, 3);
    const q = names.join(' OR ');
    return await fetchRSS(GOOGLE_NEWS(q), maxItems);
  } catch (e) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// GOVERNOR NEWS
// ─────────────────────────────────────────────────────────────────
async function getGovernorNews(stateAbbr, maxItems = 3) {
  const sd = STATE_DATA[stateAbbr];
  if (!sd) return [];
  try {
    const q = `"${sd.governor}" OR "${sd.name} governor"`;
    return await fetchRSS(GOOGLE_NEWS(q), maxItems);
  } catch (e) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// STATE LEGISLATURE — bills, votes, sessions
// ─────────────────────────────────────────────────────────────────
async function getStateLegislatureNews(stateAbbr, maxItems = 4) {
  const sd = STATE_DATA[stateAbbr];
  if (!sd) return [];
  try {
    const q = `"${sd.name}" legislature OR senate OR "house of representatives" bill OR vote OR law 2026`;
    return await fetchRSS(GOOGLE_NEWS(q), maxItems);
  } catch (e) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// COUNTY POLITICS — commissioners, ballot measures, county news
// ─────────────────────────────────────────────────────────────────
async function getCountyPolitics(city, state, maxItems = 3) {
  const sd = STATE_DATA[state];
  if (!sd) return [];
  try {
    const q = `"${city}" county commissioner OR ballot OR election OR county board`;
    return await fetchRSS(GOOGLE_NEWS(q), maxItems);
  } catch (e) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// MASTER POLITICS FETCH
// ─────────────────────────────────────────────────────────────────

/**
 * Get full political context for a user's ZIP/location.
 * Returns:
 *  - federal_reps: your senators + house rep (name, party, phone, url)
 *  - federal_news: recent news about your reps
 *  - governor: { name, party } for your state
 *  - governor_news: recent news about your governor
 *  - state_legislature: recent state bills/votes news
 *  - county: county-level political news
 */
async function getPolitics(zip, city, state) {
  const stateInfo = STATE_DATA[state] || {};

  const [federal_reps, governor_news, state_legislature, county] = await Promise.all([
    getFederalReps(zip).catch(() => []),
    getGovernorNews(state).catch(() => []),
    getStateLegislatureNews(state).catch(() => []),
    getCountyPolitics(city, state).catch(() => []),
  ]);

  // Get news about the specific reps we found
  const federal_news = await getFederalRepNews(federal_reps).catch(() => []);

  return {
    federal_reps,
    federal_news,
    governor: stateInfo.governor
      ? { name: stateInfo.governor, party: stateInfo.party, state: stateInfo.name }
      : null,
    governor_news,
    state_legislature,
    county,
  };
}

module.exports = {
  getPolitics,
  getFederalReps,
  getGovernorNews,
  getStateLegislatureNews,
  STATE_DATA,
};
