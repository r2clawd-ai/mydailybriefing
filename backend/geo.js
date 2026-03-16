/**
 * geo.js - Zip code → city/state/lat/lng + NWS grid resolution
 * Caches results in memory to avoid hammering APIs.
 */

const fetch = require('node-fetch');

const cache = new Map();

/**
 * Resolve a US zip code to location info + NWS grid.
 * @param {string} zip
 * @returns {Promise<{city, state, lat, lng, nwsGrid: {gridId, gridX, gridY}, displayName}>}
 */
async function resolveZip(zip) {
  const key = zip.trim();

  if (cache.has(key)) {
    return cache.get(key);
  }

  // 1. Zippopotam.us for lat/lng/city/state
  const zipRes = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(key)}`);
  if (!zipRes.ok) {
    throw new Error(`Unknown zip code: ${key}`);
  }

  const zipData = await zipRes.json();
  const place = zipData.places[0];
  const city  = place['place name'];
  const state = place['state abbreviation'];
  const lat   = parseFloat(place.latitude);
  const lng   = parseFloat(place.longitude);

  // 2. NWS points API for grid
  let nwsGrid = null;
  try {
    const nwsRes = await fetch(
      `https://api.weather.gov/points/${lat},${lng}`,
      { headers: { 'User-Agent': 'BriefingApp/1.0 contact@example.com' } }
    );
    if (nwsRes.ok) {
      const nwsData = await nwsRes.json();
      const props = nwsData.properties;
      nwsGrid = {
        gridId: props.gridId,
        gridX:  props.gridX,
        gridY:  props.gridY,
        forecastUrl: props.forecast,
      };
    }
  } catch (e) {
    console.warn(`NWS grid lookup failed for ${key}:`, e.message);
  }

  const result = {
    city,
    state,
    lat,
    lng,
    nwsGrid,
    displayName: `${city}, ${state}`,
  };

  cache.set(key, result);
  return result;
}

module.exports = { resolveZip };
