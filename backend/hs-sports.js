const { fixUrl } = require('./url-fix');
/**
 * hs-sports.js
 * High school sports news and scores by city/state/school name.
 *
 * Sources (all free, no API keys):
 *  - Google News RSS per school name + sport
 *  - State-level HS sports news (state athletic association + Google News)
 *  - SBLive Sports RSS (national HS sports feed)
 *  - Curated city → nearby schools map for major cities
 *
 * Onboarding: user selects their school(s) from a suggested list,
 * or types a school name manually.
 */

const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ─────────────────────────────────────────────────────────────────
// CITY → NEARBY HIGH SCHOOLS
// Curated for ~40 major markets. Used during onboarding to suggest schools.
// Format: city → [ { name, mascot, city, state, classification } ]
// ─────────────────────────────────────────────────────────────────
const CITY_SCHOOLS = {
  'Sioux Falls': [
    { name: 'Lincoln High School',        mascot: 'Patriots',  classification: 'Class AA' },
    { name: 'Washington High School',     mascot: 'Warriors',  classification: 'Class AA' },
    { name: 'Roosevelt High School',      mascot: 'Roughriders', classification: 'Class AA' },
    { name: "O'Gorman High School",       mascot: 'Knights',   classification: 'Class AA' },
    { name: 'Brandon Valley High School', mascot: 'Lynx',      classification: 'Class AA' },
    { name: 'Jefferson High School',      mascot: 'Cavaliers', classification: 'Class AA' },
    { name: 'Tea Area High School',       mascot: 'Titans',    classification: 'Class A' },
    { name: 'Harrisburg High School',     mascot: 'Tigers',    classification: 'Class AA' },
  ],
  'Minneapolis': [
    { name: 'Hopkins High School',         mascot: 'Royals',   classification: 'Class 6A' },
    { name: 'Eden Prairie High School',    mascot: 'Eagles',   classification: 'Class 6A' },
    { name: 'Wayzata High School',         mascot: 'Trojans',  classification: 'Class 6A' },
    { name: 'Minneapolis South High',      mascot: 'Tigers',   classification: 'Class 4A' },
    { name: 'Minneapolis North High',      mascot: 'Polars',   classification: 'Class 3A' },
  ],
  'Chicago': [
    { name: 'Lane Tech High School',        mascot: 'Indians',  classification: 'Class 8A' },
    { name: 'Whitney Young High School',    mascot: 'Dolphins', classification: 'Class 4A' },
    { name: 'Loyola Academy',               mascot: 'Ramblers', classification: 'Class 8A' },
    { name: 'Fenwick High School',          mascot: 'Friars',   classification: 'Class 7A' },
    { name: 'Evanston Township High School',mascot: 'Wildkits', classification: 'Class 8A' },
  ],
  'Dallas': [
    { name: 'Highland Park High School',   mascot: 'Scots',     classification: '5A' },
    { name: 'Allen High School',           mascot: 'Eagles',    classification: '6A' },
    { name: 'Southlake Carroll',           mascot: 'Dragons',   classification: '6A' },
    { name: 'Frisco Lone Star',            mascot: 'Rangers',   classification: '5A' },
  ],
  'Houston': [
    { name: 'Katy High School',            mascot: 'Tigers',    classification: '6A' },
    { name: 'Spring Branch Memorial',      mascot: 'Mustangs',  classification: '6A' },
    { name: 'Cypress Ranch High School',   mascot: 'Mustangs',  classification: '6A' },
    { name: 'The Woodlands High School',   mascot: 'Highlanders', classification: '6A' },
  ],
  'Phoenix': [
    { name: 'Chandler High School',        mascot: 'Wolves',    classification: '6A' },
    { name: 'Hamilton High School',        mascot: 'Huskies',   classification: '6A' },
    { name: 'Saguaro High School',         mascot: 'Sabercats', classification: '5A' },
    { name: 'Desert Ridge High School',    mascot: 'Jaguars',   classification: '6A' },
  ],
  'Denver': [
    { name: 'Cherry Creek High School',    mascot: 'Bruins',    classification: '5A' },
    { name: 'Regis Jesuit High School',    mascot: 'Raiders',   classification: '5A' },
    { name: 'Valor Christian High School', mascot: 'Eagles',    classification: '5A' },
    { name: 'Grandview High School',       mascot: 'Wolves',    classification: '5A' },
  ],
  'Seattle': [
    { name: 'Eastlake High School',        mascot: 'Wolves',    classification: '4A' },
    { name: 'Bellevue High School',        mascot: 'Wolverines',classification: '4A' },
    { name: 'Mount Si High School',        mascot: 'Wildcats',  classification: '4A' },
    { name: 'Bothell High School',         mascot: 'Cougars',   classification: '4A' },
  ],
  'Atlanta': [
    { name: 'North Gwinnett High School',  mascot: 'Bulldogs',  classification: '7A' },
    { name: 'Milton High School',          mascot: 'Eagles',    classification: '7A' },
    { name: 'Lassiter High School',        mascot: 'Trojans',   classification: '6A' },
    { name: 'Buford High School',          mascot: 'Wolves',    classification: '4A' },
  ],
  'Nashville': [
    { name: 'Brentwood High School',       mascot: 'Bruins',    classification: '6A' },
    { name: 'Ravenwood High School',       mascot: 'Raptors',   classification: '6A' },
    { name: 'Lipscomb Academy',            mascot: 'Mustangs',  classification: 'DII-A' },
    { name: 'MBA (Montgomery Bell)',       mascot: 'Prep',      classification: 'DII-AA' },
  ],
  'Boston': [
    { name: 'Newton North High School',    mascot: 'Tigers',    classification: 'Div 1' },
    { name: 'Needham High School',         mascot: 'Rockets',   classification: 'Div 1' },
    { name: 'BC High',                     mascot: 'Eagles',    classification: 'Div 1' },
    { name: 'St. Johns Prep',              mascot: 'Eagles',    classification: 'Div 1' },
  ],
  'Miami': [
    { name: 'St. Thomas Aquinas HS',       mascot: 'Raiders',   classification: '8M' },
    { name: 'Plantation American Heritage', mascot: 'Patriots', classification: '4M' },
    { name: 'Columbus High School',        mascot: 'Explorers', classification: '8M' },
    { name: 'Palmetto High School',        mascot: 'Panthers',  classification: '9M' },
  ],
  'Los Angeles': [
    { name: 'Mater Dei High School',       mascot: 'Monarchs',  classification: 'Open Div' },
    { name: 'St. John Bosco High School',  mascot: 'Braves',    classification: 'Open Div' },
    { name: 'Serra High School',           mascot: 'Cavaliers', classification: 'Open Div' },
    { name: 'Corona del Mar High School',  mascot: 'Sea Kings', classification: 'Open Div' },
  ],
};

// ─────────────────────────────────────────────────────────────────
// STATE → ATHLETIC ASSOCIATION NAMES (for state-level news queries)
// ─────────────────────────────────────────────────────────────────
const STATE_ATHLETIC_ASSOC = {
  SD: 'SDHSAA', MN: 'MSHSL', TX: 'UIL', CA: 'CIF', FL: 'FHSAA',
  OH: 'OHSAA', PA: 'PIAA', IL: 'IHSA', NC: 'NCHSAA', GA: 'GHSA',
  MI: 'MHSAA', NJ: 'NJSIAA', VA: 'VHSL', WA: 'WIAA', IN: 'IHSAA',
  CO: 'CHSAA', TN: 'TSSAA', AL: 'AHSAA', WI: 'WIAA', MO: 'MSHSAA',
  AZ: 'AIA', LA: 'LHSAA', KY: 'KHSAA', OK: 'OSSAA', IA: 'IHSAA',
  OR: 'OSAA', AR: 'AAA', MS: 'MHSAA', KS: 'KSHSAA', NE: 'NSAA',
  SC: 'SCHSL', UT: 'UHSAA', NV: 'NIAA', NM: 'NMAA', ID: 'IHSAA',
  WV: 'WVSSAC', MT: 'MHSA', ND: 'NDHSAA', SD: 'SDHSAA', WY: 'WHSAA',
  AK: 'ASAA', HI: 'HHSAA', ME: 'MPA', NH: 'NHIAA', VT: 'VPA',
  RI: 'RIIL', CT: 'CIAC', MA: 'MIAA', NY: 'NYSPHSAA', MD: 'MPSSAA',
  DE: 'DIAA', DC: 'DCIAA',
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const GOOGLE_NEWS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

async function fetchRSS(url, maxItems = 5) {
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
    if (!res.ok) return [];
    const text   = await res.text();
    const parsed = parser.parse(text);
    const items  = parsed?.rss?.channel?.item;
    const arr    = Array.isArray(items) ? items : (items ? [items] : []);
    return arr.slice(0, maxItems).map(i => ({
      title:   (i.title  || '').replace(/\s*-\s*[^-]{2,40}$/, '').trim(),
      url: fixUrl(i.link || i.guid || ''),
      source:  i.source?.['#text'] || '',
      pubDate: i.pubDate || '',
      type:    'hs_sports',
    }));
  } catch (e) {
    return [];
  }
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(i => {
    const key = (i.title || '').toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────
// SPORTS NEWS BY SCHOOL
// ─────────────────────────────────────────────────────────────────

/**
 * Get news for specific schools user follows.
 * @param {string[]} schoolNames  e.g. ["Lincoln High School", "O'Gorman High School"]
 * @param {string}   state        2-letter abbr
 */
async function getSchoolSportsNews(schoolNames = [], state = '') {
  if (!schoolNames.length) return [];

  const allItems = [];
  for (const school of schoolNames.slice(0, 4)) {
    const q = `"${school}" sports OR game OR score OR tournament`;
    const items = await fetchRSS(GOOGLE_NEWS(q), 3);
    allItems.push(...items);
  }
  return dedup(allItems).slice(0, 8);
}

/**
 * Get state-level HS sports news — tournaments, state rankings, playoffs.
 * @param {string} state   2-letter abbr
 * @param {string} stateName  full state name
 */
async function getStateHSSports(state, stateName) {
  const assoc = STATE_ATHLETIC_ASSOC[state] || '';
  try {
    const queries = [
      assoc ? `${assoc} ${stateName}` : null,
      `"${stateName}" high school sports tournament OR championship OR playoffs 2026`,
    ].filter(Boolean);

    const allItems = [];
    for (const q of queries) {
      const items = await fetchRSS(GOOGLE_NEWS(q), 4);
      allItems.push(...items);
    }
    return dedup(allItems).slice(0, 6);
  } catch (e) {
    return [];
  }
}

/**
 * Get nearby school suggestions for a city (for onboarding).
 * @param {string} city
 * @returns {Array} list of school objects with { name, mascot, classification }
 */
function getNearbySchools(city) {
  // Direct match
  if (CITY_SCHOOLS[city]) return CITY_SCHOOLS[city];
  // Partial match (e.g. "Sioux Falls Township" → "Sioux Falls")
  const key = Object.keys(CITY_SCHOOLS).find(k =>
    city.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(city.toLowerCase())
  );
  return key ? CITY_SCHOOLS[key] : [];
}

// ─────────────────────────────────────────────────────────────────
// MASTER HS SPORTS FETCH
// ─────────────────────────────────────────────────────────────────

/**
 * Get full HS sports context for a user.
 * @param {object} user  { city, state, hs_teams: string[] }
 * @returns { school_news, state_sports, nearby_schools }
 */
async function getHSSports(user) {
  const { city = '', state = '', hs_teams = [] } = user;

  // Derive state name from state abbr
  const { STATE_DATA } = require('./politics');
  const stateName = (STATE_DATA[state] || {}).name || state;

  const [school_news, state_sports] = await Promise.all([
    getSchoolSportsNews(hs_teams, state).catch(() => []),
    getStateHSSports(state, stateName).catch(() => []),
  ]);

  const nearby_schools = getNearbySchools(city);

  return { school_news, state_sports, nearby_schools };
}

module.exports = {
  getHSSports,
  getSchoolSportsNews,
  getStateHSSports,
  getNearbySchools,
  CITY_SCHOOLS,
};
