/**
 * geo-accounts.js
 * Curated local social accounts by city/state.
 * Returns X/Twitter, Instagram, LinkedIn handles for local news, gov, weather, sports.
 * Falls back to a Google News discovery search for unknown cities.
 */

const fetch = require('node-fetch');

// ─────────────────────────────────────────────────────────────────
// SEED DATABASE  (top ~60 US metros)
// Format: "City, ST" → { news, gov, weather, sports, community }
// Each entry has: handle (X/Twitter), name, platform, url, category
// ─────────────────────────────────────────────────────────────────
const GEO_ACCOUNTS = {
  "Sioux Falls, SD": {
    news:      [
      { handle: "@ArgusLeader",    name: "Argus Leader",        platform: "twitter", url: "https://twitter.com/ArgusLeader" },
      { handle: "@KELOLand",       name: "KELO-TV",             platform: "twitter", url: "https://twitter.com/KELOLand" },
      { handle: "@DakotaNewsNow",  name: "Dakota News Now",     platform: "twitter", url: "https://twitter.com/DakotaNewsNow" },
    ],
    gov:       [
      { handle: "@PaulTenHaken",   name: "Mayor Paul TenHaken", platform: "twitter", url: "https://twitter.com/PaulTenHaken" },
      { handle: "@CityOfSF_SD",    name: "City of Sioux Falls", platform: "twitter", url: "https://twitter.com/CityOfSF_SD" },
    ],
    weather:   [
      { handle: "@NWSAberdeen",    name: "NWS Aberdeen SD",     platform: "twitter", url: "https://twitter.com/NWSAberdeen" },
    ],
    sports:    [
      { handle: "@SFSkyforceNBA",  name: "SF Skyforce (NBA G)",  platform: "twitter", url: "https://twitter.com/SFSkyforceNBA" },
      { handle: "@SiouxFallsBird", name: "Sioux Falls Birds",    platform: "twitter", url: "https://twitter.com/SiouxFallsBird" },
    ],
    community: [
      { handle: "@VisitSiouxFalls",name: "Visit Sioux Falls",   platform: "twitter", url: "https://twitter.com/VisitSiouxFalls" },
    ],
  },

  "New York, NY": {
    news:    [
      { handle: "@NYTimes",       name: "New York Times",   platform: "twitter", url: "https://twitter.com/NYTimes" },
      { handle: "@nypost",        name: "New York Post",    platform: "twitter", url: "https://twitter.com/nypost" },
      { handle: "@NY1",           name: "NY1 News",         platform: "twitter", url: "https://twitter.com/NY1" },
      { handle: "@GothamistNYC",  name: "Gothamist",        platform: "twitter", url: "https://twitter.com/GothamistNYC" },
    ],
    gov:     [
      { handle: "@NYCMayor",      name: "NYC Mayor",        platform: "twitter", url: "https://twitter.com/NYCMayor" },
      { handle: "@NYCgov",        name: "NYC Gov",          platform: "twitter", url: "https://twitter.com/NYCgov" },
    ],
    weather: [
      { handle: "@NWSNewYorkNY",  name: "NWS New York",     platform: "twitter", url: "https://twitter.com/NWSNewYorkNY" },
    ],
    sports:  [
      { handle: "@Yankees",       name: "NY Yankees",       platform: "twitter", url: "https://twitter.com/Yankees" },
      { handle: "@Mets",          name: "NY Mets",          platform: "twitter", url: "https://twitter.com/Mets" },
      { handle: "@NYKnicks",      name: "NY Knicks",        platform: "twitter", url: "https://twitter.com/nyknicks" },
      { handle: "@Giants",        name: "NY Giants",        platform: "twitter", url: "https://twitter.com/Giants" },
    ],
    community: [
      { handle: "@ILoveNYC",      name: "I Love NYC",       platform: "twitter", url: "https://twitter.com/ILoveNYC" },
    ],
  },

  "Los Angeles, CA": {
    news:    [
      { handle: "@latimes",       name: "LA Times",         platform: "twitter", url: "https://twitter.com/latimes" },
      { handle: "@KTLA",          name: "KTLA 5 News",      platform: "twitter", url: "https://twitter.com/KTLA" },
      { handle: "@NBCLosAngeles", name: "NBC LA",           platform: "twitter", url: "https://twitter.com/NBCLosAngeles" },
    ],
    gov:     [
      { handle: "@MayorOfLA",     name: "Mayor of LA",      platform: "twitter", url: "https://twitter.com/MayorOfLA" },
    ],
    weather: [
      { handle: "@NWSSanDiego",   name: "NWS San Diego",    platform: "twitter", url: "https://twitter.com/NWSSanDiego" },
    ],
    sports:  [
      { handle: "@Dodgers",       name: "LA Dodgers",       platform: "twitter", url: "https://twitter.com/Dodgers" },
      { handle: "@Lakers",        name: "LA Lakers",        platform: "twitter", url: "https://twitter.com/Lakers" },
      { handle: "@RamsNFL",       name: "LA Rams",          platform: "twitter", url: "https://twitter.com/RamsNFL" },
    ],
    community: [
      { handle: "@DiscoverLA",    name: "Discover LA",      platform: "twitter", url: "https://twitter.com/DiscoverLA" },
    ],
  },

  "Chicago, IL": {
    news:    [
      { handle: "@chicagotribune",name: "Chicago Tribune",  platform: "twitter", url: "https://twitter.com/chicagotribune" },
      { handle: "@suntimes",      name: "Chicago Sun-Times",platform: "twitter", url: "https://twitter.com/suntimes" },
      { handle: "@WGNNews",       name: "WGN News",         platform: "twitter", url: "https://twitter.com/WGNNews" },
    ],
    gov:     [
      { handle: "@ChicagosMayor", name: "Mayor of Chicago", platform: "twitter", url: "https://twitter.com/ChicagosMayor" },
    ],
    weather: [
      { handle: "@NWSChicago",    name: "NWS Chicago",      platform: "twitter", url: "https://twitter.com/NWSChicago" },
    ],
    sports:  [
      { handle: "@Cubs",          name: "Chicago Cubs",     platform: "twitter", url: "https://twitter.com/Cubs" },
      { handle: "@ChiSox",        name: "Chicago White Sox",platform: "twitter", url: "https://twitter.com/ChiSox" },
      { handle: "@chicagobulls",  name: "Chicago Bulls",    platform: "twitter", url: "https://twitter.com/chicagobulls" },
      { handle: "@ChicagoBears",  name: "Chicago Bears",    platform: "twitter", url: "https://twitter.com/ChicagoBears" },
    ],
    community: [],
  },

  "Houston, TX": {
    news:    [
      { handle: "@HoustonChron",  name: "Houston Chronicle", platform: "twitter", url: "https://twitter.com/HoustonChron" },
      { handle: "@KHOU",          name: "KHOU 11 News",      platform: "twitter", url: "https://twitter.com/KHOU" },
    ],
    gov:     [{ handle: "@SylvesterTurner", name: "Houston Mayor", platform: "twitter", url: "https://twitter.com/SylvesterTurner" }],
    weather: [{ handle: "@NWSHouston",  name: "NWS Houston",      platform: "twitter", url: "https://twitter.com/NWSHouston" }],
    sports:  [
      { handle: "@astros",        name: "Houston Astros",    platform: "twitter", url: "https://twitter.com/astros" },
      { handle: "@HoustonTexans", name: "Houston Texans",    platform: "twitter", url: "https://twitter.com/HoustonTexans" },
      { handle: "@HoustonRockets",name: "Houston Rockets",   platform: "twitter", url: "https://twitter.com/HoustonRockets" },
    ],
    community: [],
  },

  "Phoenix, AZ": {
    news:    [
      { handle: "@azcentral",     name: "AZCentral",         platform: "twitter", url: "https://twitter.com/azcentral" },
      { handle: "@abc15",         name: "ABC15 Arizona",     platform: "twitter", url: "https://twitter.com/abc15" },
    ],
    gov:     [{ handle: "@KateMGallego",  name: "Phoenix Mayor",    platform: "twitter", url: "https://twitter.com/KateMGallego" }],
    weather: [{ handle: "@NWSPhoenix",   name: "NWS Phoenix",      platform: "twitter", url: "https://twitter.com/NWSPhoenix" }],
    sports:  [
      { handle: "@Dbacks",        name: "Arizona Diamondbacks",platform: "twitter", url: "https://twitter.com/Dbacks" },
      { handle: "@Cardinals",     name: "Arizona Cardinals",  platform: "twitter", url: "https://twitter.com/AZCardinals" },
      { handle: "@Suns",          name: "Phoenix Suns",       platform: "twitter", url: "https://twitter.com/Suns" },
    ],
    community: [],
  },

  "Philadelphia, PA": {
    news:    [
      { handle: "@PhillyInquirer",name: "Philadelphia Inquirer", platform: "twitter", url: "https://twitter.com/PhillyInquirer" },
      { handle: "@6abc",          name: "6abc Philadelphia",  platform: "twitter", url: "https://twitter.com/6abc" },
    ],
    gov:     [{ handle: "@PhillyMayor",  name: "Philadelphia Mayor", platform: "twitter", url: "https://twitter.com/PhillyMayor" }],
    weather: [{ handle: "@NWSPhiladelphia", name: "NWS Philadelphia", platform: "twitter", url: "https://twitter.com/NWSPhiladelphia" }],
    sports:  [
      { handle: "@Phillies",      name: "Philadelphia Phillies",platform: "twitter", url: "https://twitter.com/Phillies" },
      { handle: "@Eagles",        name: "Philadelphia Eagles",  platform: "twitter", url: "https://twitter.com/Eagles" },
      { handle: "@sixers",        name: "Philadelphia 76ers",   platform: "twitter", url: "https://twitter.com/sixers" },
    ],
    community: [],
  },

  "San Antonio, TX": {
    news:    [
      { handle: "@mySA",          name: "MySA (Express-News)", platform: "twitter", url: "https://twitter.com/mySA" },
      { handle: "@KENS5",         name: "KENS 5 News",        platform: "twitter", url: "https://twitter.com/KENS5" },
    ],
    gov:     [{ handle: "@Ron_Nirenberg", name: "SA Mayor",         platform: "twitter", url: "https://twitter.com/Ron_Nirenberg" }],
    weather: [{ handle: "@NWSSanAntonio", name: "NWS San Antonio",  platform: "twitter", url: "https://twitter.com/NWSSanAntonio" }],
    sports:  [{ handle: "@spurs",         name: "San Antonio Spurs", platform: "twitter", url: "https://twitter.com/spurs" }],
    community: [],
  },

  "Dallas, TX": {
    news:    [
      { handle: "@dallasnews",    name: "Dallas Morning News", platform: "twitter", url: "https://twitter.com/dallasnews" },
      { handle: "@wfaa",          name: "WFAA News",           platform: "twitter", url: "https://twitter.com/wfaa" },
    ],
    gov:     [{ handle: "@MayorJohnsonDTX", name: "Dallas Mayor",   platform: "twitter", url: "https://twitter.com/MayorJohnsonDTX" }],
    weather: [{ handle: "@NWSDFWFort",      name: "NWS DFW",        platform: "twitter", url: "https://twitter.com/NWSDFWFort" }],
    sports:  [
      { handle: "@Rangers",       name: "Texas Rangers",      platform: "twitter", url: "https://twitter.com/Rangers" },
      { handle: "@dallascowboys", name: "Dallas Cowboys",     platform: "twitter", url: "https://twitter.com/dallascowboys" },
      { handle: "@dallasmavs",    name: "Dallas Mavericks",   platform: "twitter", url: "https://twitter.com/dallasmavs" },
    ],
    community: [],
  },

  "San Diego, CA": {
    news:    [
      { handle: "@sdut",          name: "San Diego Union-Tribune", platform: "twitter", url: "https://twitter.com/sdut" },
      { handle: "@NBCSanDiego",   name: "NBC 7 San Diego",         platform: "twitter", url: "https://twitter.com/NBCSanDiego" },
    ],
    gov:     [{ handle: "@MayorToddGloria", name: "San Diego Mayor", platform: "twitter", url: "https://twitter.com/MayorToddGloria" }],
    weather: [{ handle: "@NWSSanDiego",     name: "NWS San Diego",   platform: "twitter", url: "https://twitter.com/NWSSanDiego" }],
    sports:  [
      { handle: "@Padres",        name: "San Diego Padres",   platform: "twitter", url: "https://twitter.com/Padres" },
    ],
    community: [],
  },

  "Austin, TX": {
    news:    [
      { handle: "@statesman",     name: "Austin American-Statesman", platform: "twitter", url: "https://twitter.com/statesman" },
      { handle: "@KVUE",          name: "KVUE Austin",               platform: "twitter", url: "https://twitter.com/KVUE" },
    ],
    gov:     [{ handle: "@MayorAdler",   name: "Austin Mayor",       platform: "twitter", url: "https://twitter.com/MayorAdler" }],
    weather: [{ handle: "@NWSSanAntonio",name: "NWS San Antonio/Austin", platform: "twitter", url: "https://twitter.com/NWSSanAntonio" }],
    sports:  [{ handle: "@AustinFC",     name: "Austin FC (MLS)",    platform: "twitter", url: "https://twitter.com/AustinFC" }],
    community: [{ handle: "@VisitAustin", name: "Visit Austin",      platform: "twitter", url: "https://twitter.com/VisitAustin" }],
  },

  "Denver, CO": {
    news:    [
      { handle: "@denverpost",    name: "Denver Post",         platform: "twitter", url: "https://twitter.com/denverpost" },
      { handle: "@9NEWS",         name: "9NEWS Denver",        platform: "twitter", url: "https://twitter.com/9NEWS" },
    ],
    gov:     [{ handle: "@MayorHandcock",  name: "Denver Mayor",    platform: "twitter", url: "https://twitter.com/MayorHandcock" }],
    weather: [{ handle: "@NWSBoulder",     name: "NWS Boulder/Denver", platform: "twitter", url: "https://twitter.com/NWSBoulder" }],
    sports:  [
      { handle: "@Broncos",       name: "Denver Broncos",     platform: "twitter", url: "https://twitter.com/Broncos" },
      { handle: "@Rockies",       name: "Colorado Rockies",   platform: "twitter", url: "https://twitter.com/Rockies" },
      { handle: "@nuggets",       name: "Denver Nuggets",     platform: "twitter", url: "https://twitter.com/nuggets" },
    ],
    community: [],
  },

  "Seattle, WA": {
    news:    [
      { handle: "@seattletimes",  name: "Seattle Times",       platform: "twitter", url: "https://twitter.com/seattletimes" },
      { handle: "@KING5Seattle",  name: "KING 5 News",         platform: "twitter", url: "https://twitter.com/KING5Seattle" },
    ],
    gov:     [{ handle: "@MayorHarrell",   name: "Seattle Mayor",   platform: "twitter", url: "https://twitter.com/MayorHarrell" }],
    weather: [{ handle: "@NWSSeattle",     name: "NWS Seattle",     platform: "twitter", url: "https://twitter.com/NWSSeattle" }],
    sports:  [
      { handle: "@Mariners",      name: "Seattle Mariners",   platform: "twitter", url: "https://twitter.com/Mariners" },
      { handle: "@Seahawks",      name: "Seattle Seahawks",   platform: "twitter", url: "https://twitter.com/Seahawks" },
    ],
    community: [],
  },

  "Minneapolis, MN": {
    news:    [
      { handle: "@StarTribune",   name: "Star Tribune",        platform: "twitter", url: "https://twitter.com/StarTribune" },
      { handle: "@kare11",        name: "KARE 11 News",        platform: "twitter", url: "https://twitter.com/kare11" },
    ],
    gov:     [{ handle: "@MayorFrey",      name: "Minneapolis Mayor", platform: "twitter", url: "https://twitter.com/MayorFrey" }],
    weather: [{ handle: "@NWSMinneapolis", name: "NWS Minneapolis",  platform: "twitter", url: "https://twitter.com/NWSMinneapolis" }],
    sports:  [
      { handle: "@Twins",         name: "Minnesota Twins",    platform: "twitter", url: "https://twitter.com/Twins" },
      { handle: "@Vikings",       name: "Minnesota Vikings",  platform: "twitter", url: "https://twitter.com/Vikings" },
      { handle: "@Timberwolves",  name: "Minnesota Timberwolves", platform: "twitter", url: "https://twitter.com/Timberwolves" },
    ],
    community: [],
  },

  "Portland, OR": {
    news:    [
      { handle: "@Oregonian",     name: "The Oregonian",       platform: "twitter", url: "https://twitter.com/Oregonian" },
      { handle: "@KGWNews",       name: "KGW News",            platform: "twitter", url: "https://twitter.com/KGWNews" },
    ],
    gov:     [{ handle: "@tedwheeler",     name: "Portland Mayor",  platform: "twitter", url: "https://twitter.com/tedwheeler" }],
    weather: [{ handle: "@NWSPortland",   name: "NWS Portland",    platform: "twitter", url: "https://twitter.com/NWSPortland" }],
    sports:  [
      { handle: "@trailblazers",  name: "Portland Trail Blazers", platform: "twitter", url: "https://twitter.com/trailblazers" },
    ],
    community: [],
  },

  "Miami, FL": {
    news:    [
      { handle: "@MiamiHerald",   name: "Miami Herald",        platform: "twitter", url: "https://twitter.com/MiamiHerald" },
      { handle: "@wplg",          name: "Local 10 News",       platform: "twitter", url: "https://twitter.com/WPLGLocal10" },
    ],
    gov:     [{ handle: "@FrancisSuarez",  name: "Miami Mayor",     platform: "twitter", url: "https://twitter.com/FrancisSuarez" }],
    weather: [{ handle: "@NWSMiami",       name: "NWS Miami",       platform: "twitter", url: "https://twitter.com/NWSMiami" }],
    sports:  [
      { handle: "@Marlins",       name: "Miami Marlins",      platform: "twitter", url: "https://twitter.com/Marlins" },
      { handle: "@MiamiDolphins", name: "Miami Dolphins",     platform: "twitter", url: "https://twitter.com/MiamiDolphins" },
      { handle: "@MiamiHEAT",     name: "Miami Heat",         platform: "twitter", url: "https://twitter.com/MiamiHEAT" },
    ],
    community: [],
  },

  "Atlanta, GA": {
    news:    [
      { handle: "@ajc",           name: "Atlanta Journal-Constitution", platform: "twitter", url: "https://twitter.com/ajc" },
      { handle: "@wsbtv",         name: "WSB-TV Atlanta",     platform: "twitter", url: "https://twitter.com/wsbtv" },
    ],
    gov:     [{ handle: "@MayorDickens",   name: "Atlanta Mayor",   platform: "twitter", url: "https://twitter.com/MayorDickens" }],
    weather: [{ handle: "@NWSAtlanta",     name: "NWS Atlanta",     platform: "twitter", url: "https://twitter.com/NWSAtlanta" }],
    sports:  [
      { handle: "@Braves",        name: "Atlanta Braves",     platform: "twitter", url: "https://twitter.com/Braves" },
      { handle: "@AtlantaFalcons",name: "Atlanta Falcons",    platform: "twitter", url: "https://twitter.com/AtlantaFalcons" },
      { handle: "@ATLHawks",      name: "Atlanta Hawks",      platform: "twitter", url: "https://twitter.com/ATLHawks" },
    ],
    community: [],
  },

  "Boston, MA": {
    news:    [
      { handle: "@BostonGlobe",   name: "Boston Globe",        platform: "twitter", url: "https://twitter.com/BostonGlobe" },
      { handle: "@NBC10Boston",   name: "NBC10 Boston",        platform: "twitter", url: "https://twitter.com/NBC10Boston" },
    ],
    gov:     [{ handle: "@MayorWu",        name: "Boston Mayor",    platform: "twitter", url: "https://twitter.com/MayorWu" }],
    weather: [{ handle: "@NWSBoston",      name: "NWS Boston",      platform: "twitter", url: "https://twitter.com/NWSBoston" }],
    sports:  [
      { handle: "@RedSox",        name: "Boston Red Sox",     platform: "twitter", url: "https://twitter.com/RedSox" },
      { handle: "@Patriots",      name: "New England Patriots",platform: "twitter", url: "https://twitter.com/Patriots" },
      { handle: "@celtics",       name: "Boston Celtics",     platform: "twitter", url: "https://twitter.com/celtics" },
    ],
    community: [],
  },

  "Las Vegas, NV": {
    news:    [
      { handle: "@reviewjournal", name: "Las Vegas Review-Journal", platform: "twitter", url: "https://twitter.com/reviewjournal" },
      { handle: "@8NewsNow",      name: "8 News Now",          platform: "twitter", url: "https://twitter.com/8NewsNow" },
    ],
    gov:     [{ handle: "@CityOfLasVegas", name: "City of Las Vegas", platform: "twitter", url: "https://twitter.com/CityOfLasVegas" }],
    weather: [{ handle: "@NWSVegas",       name: "NWS Las Vegas",   platform: "twitter", url: "https://twitter.com/NWSVegas" }],
    sports:  [
      { handle: "@GoldenKnights", name: "Vegas Golden Knights",platform: "twitter", url: "https://twitter.com/GoldenKnights" },
      { handle: "@Raiders",       name: "Las Vegas Raiders",   platform: "twitter", url: "https://twitter.com/Raiders" },
    ],
    community: [],
  },

  "Nashville, TN": {
    news:    [
      { handle: "@Tennessean",    name: "The Tennessean",      platform: "twitter", url: "https://twitter.com/Tennessean" },
      { handle: "@NC5i",          name: "NewsChannel 5",       platform: "twitter", url: "https://twitter.com/NC5i" },
    ],
    gov:     [{ handle: "@fredericknation", name: "Nashville Mayor", platform: "twitter", url: "https://twitter.com/fredericknation" }],
    weather: [{ handle: "@NWSNashville",   name: "NWS Nashville",   platform: "twitter", url: "https://twitter.com/NWSNashville" }],
    sports:  [
      { handle: "@Predators",     name: "Nashville Predators", platform: "twitter", url: "https://twitter.com/PredsNHL" },
      { handle: "@Titans",        name: "Tennessee Titans",    platform: "twitter", url: "https://twitter.com/Titans" },
    ],
    community: [],
  },
};

// ─────────────────────────────────────────────────────────────────
// LOOKUP + DISCOVERY
// ─────────────────────────────────────────────────────────────────

/**
 * Get curated accounts for a city. Falls back to discovery search.
 * @param {string} city
 * @param {string} state  (2-letter abbreviation)
 * @returns {Promise<{news, gov, weather, sports, community, discovered}>}
 */
async function getLocalAccounts(city, state) {
  const key = `${city}, ${state}`;
  const curated = GEO_ACCOUNTS[key];

  if (curated) {
    return { ...curated, discovered: false };
  }

  // Discovery: use Google News to find local outlets, derive Twitter handles
  const discovered = await discoverLocalAccounts(city, state);
  return { ...discovered, discovered: true };
}

/**
 * For cities not in the curated DB, search Google News to find local outlets
 * and build a minimal account list.
 */
async function discoverLocalAccounts(city, state) {
  const { XMLParser } = require('fast-xml-parser');
  const parser = new XMLParser({ ignoreAttributes: false });

  const GOOGLE_NEWS = (q) =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

  const discovered = [];

  try {
    const url = GOOGLE_NEWS(`${city} ${state} local news`);
    const res = await fetch(url, { headers: { 'User-Agent': 'BriefingApp/1.0' }, timeout: 8000 });
    if (res.ok) {
      const text = await res.text();
      const parsed = parser.parse(text);
      const items = parsed?.rss?.channel?.item;
      const arr   = Array.isArray(items) ? items : (items ? [items] : []);

      // Extract source names from top articles, build discovery entries
      const seen = new Set();
      for (const item of arr.slice(0, 6)) {
        const sourceName = item.source?.['#text'] || item.source || '';
        if (sourceName && !seen.has(sourceName)) {
          seen.add(sourceName);
          discovered.push({
            handle: null,
            name:   sourceName,
            platform: 'web',
            url:    item.link || item.guid || '',
            category: 'news',
          });
        }
      }
    }
  } catch (e) {
    console.warn(`Account discovery failed for ${city}, ${state}:`, e.message);
  }

  // Always add the local NWS office
  const NWS_OFFICES = {
    AK: '@NWSAnchorage', AL: '@NWSBirmingham', AR: '@NWSLittleRock',
    AZ: '@NWSPhoenix',   CA: '@NWSLosAngeles', CO: '@NWSBoulder',
    CT: '@NWSBoston',    DC: '@NWSBaltimore',  DE: '@NWSPhiladelphia',
    FL: '@NWSMiami',     GA: '@NWSAtlanta',    HI: '@NWSHonolulu',
    IA: '@NWSDavenport', ID: '@NWSBoise',      IL: '@NWSChicago',
    IN: '@NWSIndianapolis', KS: '@NWSWichita', KY: '@NWSLouisville',
    LA: '@NWSNewOrleans', MA: '@NWSBoston',    MD: '@NWSBaltimore',
    ME: '@NWSGray',      MI: '@NWSDetroit',   MN: '@NWSMinneapolis',
    MO: '@NWSStLouis',   MS: '@NWSJackson',   MT: '@NWSBillings',
    NC: '@NWSRaleigh',   ND: '@NWSBismarck',  NE: '@NWSOmaha',
    NH: '@NWSGray',      NJ: '@NWSPhiladelphia', NM: '@NWSAlbuquerque',
    NV: '@NWSVegas',     NY: '@NWSNewYorkNY', OH: '@NWSCleveland',
    OK: '@NWSOklahoma',  OR: '@NWSPortland',  PA: '@NWSPhiladelphia',
    RI: '@NWSBoston',    SC: '@NWSColumbia',  SD: '@NWSAberdeen',
    TN: '@NWSNashville', TX: '@NWSHouston',   UT: '@NWSSaltLake',
    VA: '@NWSWakefield', VT: '@NWSBurlington',WA: '@NWSSeattle',
    WI: '@NWSMilwaukee', WV: '@NWSCharles',   WY: '@NWSRiverdale',
  };

  const nwsHandle = NWS_OFFICES[state] || '@NWS';

  return {
    news:    discovered.filter(a => a.category === 'news' || !a.category),
    gov:     [],
    weather: [{ handle: nwsHandle, name: `NWS ${state}`, platform: 'twitter', url: `https://twitter.com/${nwsHandle.slice(1)}` }],
    sports:  [],
    community: [],
  };
}

/**
 * Get "you might also like" suggestions — accounts adjacent to user's interests
 * that are nationally relevant + location-connected.
 */
function getSuggestedNational(interests = []) {
  const NATIONAL = {
    finance:     [
      { handle: '@markets',       name: 'Bloomberg Markets',    platform: 'twitter', url: 'https://twitter.com/markets' },
      { handle: '@WSJ',           name: 'Wall Street Journal',  platform: 'twitter', url: 'https://twitter.com/WSJ' },
      { handle: '@RealVision',    name: 'Real Vision Finance',  platform: 'twitter', url: 'https://twitter.com/RealVision' },
    ],
    crypto:      [
      { handle: '@coindesk',      name: 'CoinDesk',             platform: 'twitter', url: 'https://twitter.com/coindesk' },
      { handle: '@Cointelegraph', name: 'Cointelegraph',        platform: 'twitter', url: 'https://twitter.com/Cointelegraph' },
    ],
    tech:        [
      { handle: '@verge',         name: 'The Verge',            platform: 'twitter', url: 'https://twitter.com/verge' },
      { handle: '@techcrunch',    name: 'TechCrunch',           platform: 'twitter', url: 'https://twitter.com/techcrunch' },
    ],
    politics:    [
      { handle: '@politico',      name: 'Politico',             platform: 'twitter', url: 'https://twitter.com/politico' },
      { handle: '@thehill',       name: 'The Hill',             platform: 'twitter', url: 'https://twitter.com/thehill' },
    ],
    sports:      [
      { handle: '@espn',          name: 'ESPN',                 platform: 'twitter', url: 'https://twitter.com/espn' },
      { handle: '@TheAthleticNFL',name: 'The Athletic',         platform: 'twitter', url: 'https://twitter.com/TheAthleticNFL' },
    ],
    philosophy:  [
      { handle: '@DailyDale',     name: 'Daily Stoic',          platform: 'twitter', url: 'https://twitter.com/DailyDale' },
      { handle: '@RyanHoliday',   name: 'Ryan Holiday',         platform: 'twitter', url: 'https://twitter.com/RyanHoliday' },
    ],
    health:      [
      { handle: '@statnews',      name: 'STAT News',            platform: 'twitter', url: 'https://twitter.com/statnews' },
    ],
    science:     [
      { handle: '@NatGeo',        name: 'National Geographic',  platform: 'twitter', url: 'https://twitter.com/NatGeo' },
      { handle: '@ScienceNews',   name: 'Science News',         platform: 'twitter', url: 'https://twitter.com/ScienceNews' },
    ],
    entertainment:[
      { handle: '@EW',            name: 'Entertainment Weekly', platform: 'twitter', url: 'https://twitter.com/EW' },
      { handle: '@THR',           name: 'Hollywood Reporter',   platform: 'twitter', url: 'https://twitter.com/THR' },
    ],
  };

  const suggestions = [];
  const seen = new Set();
  for (const interest of interests) {
    const key = interest.toLowerCase();
    const list = NATIONAL[key] || [];
    for (const acct of list) {
      if (!seen.has(acct.handle)) {
        seen.add(acct.handle);
        suggestions.push({ ...acct, reason: interest });
      }
    }
  }
  return suggestions;
}

module.exports = { getLocalAccounts, getSuggestedNational };
