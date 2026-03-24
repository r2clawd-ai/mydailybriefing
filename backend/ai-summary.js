/**
 * ai-summary.js
 * Generates a short AI-written morning briefing summary from section data.
 * Uses Anthropic claude-haiku (fast, cheap) via the claude-max proxy if available,
 * falling back to a template-based summary if no API key.
 */

const fetch = require('node-fetch');

const PROXY_URL = 'http://localhost:3456/v1';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1';

async function callClaude(prompt) {
  // Try claude-max proxy first (free via subscription)
  for (const [url, auth] of [
    [PROXY_URL + '/messages', 'proxy'],
    [ANTHROPIC_URL + '/messages', 'anthropic'],
  ]) {
    try {
      const apiKey = auth === 'proxy' ? 'not-needed' : (process.env.ANTHROPIC_API_KEY || '');
      if (auth === 'anthropic' && !apiKey) continue;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
        timeout: 8000,
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.content?.[0]?.text?.trim() || null;
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

/**
 * Build a template summary when AI is unavailable.
 */
function templateSummary(briefingData, userName) {
  const greeting = userName ? `Good morning, ${userName.split(' ')[0]}` : 'Good morning';
  const parts = [];

  // Weather
  const w = briefingData.weather;
  if (w?.current) {
    const p = w.current;
    parts.push(`${p.name || 'Today'}: ${p.shortForecast || p.detailedForecast?.split('.')[0] || ''}.`);
  }

  // Top news headline
  const news = briefingData.local_news?.[0] || briefingData.national_news?.[0];
  if (news?.title) {
    parts.push(`Top story: ${news.title}.`);
  }

  // Markets
  const markets = briefingData.markets;
  if (Array.isArray(markets) && markets.length > 0) {
    const spy = markets.find(m => m.symbol === 'SPY');
    if (spy && spy.changePercent != null) {
      const dir = spy.changePercent >= 0 ? 'up' : 'down';
      parts.push(`Markets: S&P 500 ${dir} ${Math.abs(spy.changePercent).toFixed(1)}%.`);
    }
  }

  if (!parts.length) return `${greeting}! Here's your briefing.`;
  return `${greeting}. ${parts.join(' ')}`;
}

/**
 * Generate an AI morning summary paragraph for the top of the briefing.
 * Returns a string (never throws).
 */
async function generateMorningSummary(briefingData, userName) {
  try {
    // Build a compact data snapshot for the prompt
    const weatherLine = (() => {
      const w = briefingData.weather;
      if (!w?.current) return '';
      const p = w.current;
      return `Weather: ${p.name}: ${p.shortForecast || ''}, ${p.temperature}°${p.temperatureUnit || 'F'}`;
    })();

    const newsLines = [
      ...(briefingData.local_news || []).slice(0, 3),
      ...(briefingData.national_news || []).slice(0, 3),
    ].map(n => `- ${n.title}`).join('\n');

    const marketLine = (() => {
      const m = Array.isArray(briefingData.markets) ? briefingData.markets : [];
      return m.slice(0, 3).map(s =>
        `${s.symbol}: $${s.price?.toFixed(2) || '?'} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent?.toFixed(1) || '?'}%)`
      ).join(', ');
    })();

    if (!weatherLine && !newsLines && !marketLine) {
      return templateSummary(briefingData, userName);
    }

    const name = userName ? userName.split(' ')[0] : 'there';
    const prompt = `You write short, punchy morning briefing summaries. Write 2-3 sentences max. Conversational, direct, no fluff.

Data:
${weatherLine}
${marketLine ? 'Markets: ' + marketLine : ''}
Top headlines:
${newsLines || '(none)'}

Write a morning greeting for "${name}" that highlights the 1-2 most important things from today's data. Be specific (mention actual numbers/names). End with one actionable thought. Keep it under 60 words.`;

    const aiText = await callClaude(prompt);
    if (aiText && aiText.length > 20) return aiText;
  } catch (_) {}

  return templateSummary(briefingData, userName);
}

/**
 * Generate a 1-line "smart headline" for each news article (for improved readability).
 * Only used if AI is available. Returns array same length as input.
 */
async function enhanceHeadlines(articles) {
  if (!articles || articles.length === 0) return articles;
  // Only enhance top 5 to keep latency low
  const toEnhance = articles.slice(0, 5);
  const rest = articles.slice(5);

  try {
    const titles = toEnhance.map(a => a.title).join('\n');
    const prompt = `Rewrite these news headlines to be clearer and more engaging. Keep each under 10 words. Return ONLY the rewritten headlines, one per line, in the same order:

${titles}`;

    const result = await callClaude(prompt);
    if (result) {
      const lines = result.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      if (lines.length === toEnhance.length) {
        const enhanced = toEnhance.map((a, i) => ({ ...a, enhanced_title: lines[i] }));
        return [...enhanced, ...rest];
      }
    }
  } catch (_) {}

  return articles;
}

module.exports = { generateMorningSummary, enhanceHeadlines, templateSummary };
