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

function normalizeItem(item) {
  return {
    title:       item.title       || '',
    link:        item.link        || item.guid || '',
    source:      item.source?.['#text'] || item.source || item['dc:creator'] || '',
    published:   item.pubDate     || item['dc:date'] || '',
    description: item.description ? stripHTML(item.description).slice(0, 200) : '',
  };
}

function stripHTML(str) {
  return String(str).replace(/<[^>]*>/g, '').trim();
}

function dedup(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = (a.title || '').toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const q = `${city} ${state} news`;
    const items = await fetchRSS(GOOGLE_NEWS_RSS(q));
    return dedup(items.slice(0, 5).map(normalizeItem));
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
  if (!teams.length) return [];
  try {
    const allItems = [];
    for (const team of teams.slice(0, 5)) {
      const items = await fetchRSS(GOOGLE_NEWS_RSS(`${team} sports`));
      allItems.push(...items.slice(0, 2).map(normalizeItem));
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
 * Get market data for an array of stock tickers via yfinance Python subprocess.
 */
async function getMarkets(stocks = ['SPY', 'QQQ', 'BTC-USD']) {
  return new Promise((resolve) => {
    const tickers = stocks.length ? stocks : ['SPY', 'QQQ', 'BTC-USD'];
    const tickerList = tickers.map(s => s.trim()).join(' ');

    const pyCode = `
import yfinance as yf, json, sys
tickers = "${tickerList}".split()
results = []
for sym in tickers:
    try:
        t = yf.Ticker(sym)
        info = t.fast_info
        hist = t.history(period="2d")
        if len(hist) >= 1:
            price = float(hist['Close'].iloc[-1])
            prev  = float(hist['Close'].iloc[-2]) if len(hist) >= 2 else price
            chg   = price - prev
            pct   = (chg / prev * 100) if prev else 0
            results.append({
                "symbol": sym,
                "price": round(price, 4),
                "change": round(chg, 4),
                "change_pct": round(pct, 2),
                "direction": "up" if chg >= 0 else "down"
            })
    except Exception as e:
        results.append({"symbol": sym, "error": str(e)})
print(json.dumps(results))
`.trim();

    exec(`python3 -c '${pyCode.replace(/'/g, `'"'"'`)}'`, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn('Markets subprocess error:', err.message);
        resolve([]);
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        resolve(Array.isArray(data) ? data : []);
      } catch (parseErr) {
        console.warn('Markets JSON parse error:', parseErr.message, '|', stdout.slice(0, 200));
        resolve([]);
      }
    });
  });
}

module.exports = { getWeather, getLocalNews, getNationalNews, getSportsNews, getTopicNews, getMarkets };

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
