/**
 * email-template.js
 * HTML email template for mydailybriefing.app daily digest.
 * Accepts a briefing sections object and returns a complete HTML email string.
 */

'use strict';

/**
 * Escape HTML special chars to prevent injection from external content.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderWeather(weather) {
  if (!weather || !weather.current) return '';
  const c = weather.current;
  const temp = c.temperature != null ? `${c.temperature}°${c.temperatureUnit || 'F'}` : '';
  const desc = esc(c.shortForecast || c.description || '');
  const action = esc(c.action || '');
  const periods = Array.isArray(weather.periods) ? weather.periods.slice(0, 4) : [];

  const periodRows = periods.map(p => `
    <tr>
      <td style="padding:4px 8px 4px 0;color:#a0aec0;font-size:13px;white-space:nowrap;">${esc(p.name)}</td>
      <td style="padding:4px 0;color:#e2e8f0;font-size:13px;">${esc(p.shortForecast)} &nbsp;${p.temperature != null ? `<strong>${p.temperature}°${p.temperatureUnit || 'F'}</strong>` : ''}</td>
    </tr>`).join('');

  return sectionWrap('Weather', `
    <p style="margin:0 0 8px;font-size:28px;font-weight:700;color:#f7fafc;">
      ${temp} &nbsp;<span style="font-size:18px;font-weight:400;color:#a0aec0;">${desc}</span>
    </p>
    ${action ? `<p style="margin:0 0 12px;color:#68d391;font-size:14px;">&#x2713; ${action}</p>` : ''}
    ${periodRows ? `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:420px;">${periodRows}</table>` : ''}
  `);
}

function renderMarkets(markets) {
  if (!Array.isArray(markets) || markets.length === 0) return '';
  const rows = markets.slice(0, 6).map(m => {
    const changeColor = (m.change >= 0) ? '#68d391' : '#fc8181';
    const arrow = (m.change >= 0) ? '&#9650;' : '&#9660;';
    const pct = m.changePercent != null ? `${m.changePercent > 0 ? '+' : ''}${Number(m.changePercent).toFixed(2)}%` : '';
    return `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#e2e8f0;font-size:14px;font-weight:600;">${esc(m.symbol)}</td>
        <td style="padding:6px 12px 6px 0;color:#a0aec0;font-size:13px;">${esc(m.name || '')}</td>
        <td style="padding:6px 0;text-align:right;color:#f7fafc;font-size:14px;">${m.price != null ? Number(m.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''}</td>
        <td style="padding:6px 0 6px 12px;text-align:right;color:${changeColor};font-size:13px;white-space:nowrap;">${arrow} ${pct}</td>
      </tr>`;
  }).join('');
  return sectionWrap('Markets', `
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      ${rows}
    </table>
  `);
}

function renderNewsList(title, items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const links = items.slice(0, 6).map(item => {
    const headline = esc(item.title || item.headline || '');
    const source   = esc(item.source || item.publisher || '');
    const url      = item.url || item.link || '#';
    return `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #2d3748;">
          <a href="${esc(url)}" style="color:#90cdf4;text-decoration:none;font-size:14px;line-height:1.4;">${headline}</a>
          ${source ? `<br><span style="color:#718096;font-size:11px;">${source}</span>` : ''}
        </td>
      </tr>`;
  }).join('');
  return sectionWrap(title, `
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      ${links}
    </table>
  `);
}

function renderSports(sports) {
  return renderNewsList('Sports', sports);
}

function renderInterests(interests) {
  return renderNewsList('Your Interests', interests);
}

function renderPolitics(politics) {
  if (!politics || typeof politics !== 'object') return '';
  const allItems = [
    ...(politics.governor_news     || []),
    ...(politics.state_legislature || []),
    ...(politics.federal_news      || []),
    ...(politics.county            || []),
  ].slice(0, 6);
  if (allItems.length === 0) return '';
  return renderNewsList('Politics', allItems);
}

function renderCalendar(calendar) {
  if (!Array.isArray(calendar) || calendar.length === 0) return '';
  const rows = calendar.slice(0, 5).map(ev => {
    const title = esc(ev.title || ev.summary || '');
    const time  = esc(ev.time  || ev.start   || '');
    return `
      <tr>
        <td style="padding:5px 10px 5px 0;color:#a0aec0;font-size:12px;white-space:nowrap;vertical-align:top;">${time}</td>
        <td style="padding:5px 0;color:#e2e8f0;font-size:14px;">${title}</td>
      </tr>`;
  }).join('');
  return sectionWrap('Today\'s Calendar', `
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      ${rows}
    </table>
  `);
}

function renderMorningSummary(summary) {
  if (!summary) return '';
  const text = typeof summary === 'string' ? summary : (summary.text || summary.summary || '');
  if (!text) return '';
  return `
    <div style="background:#1a2744;border-left:4px solid #667eea;border-radius:4px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#667eea;font-weight:700;">AI Morning Summary</p>
      <p style="margin:0;color:#e2e8f0;font-size:15px;line-height:1.6;">${esc(text)}</p>
    </div>`;
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function sectionWrap(title, body) {
  return `
    <div style="margin:0 0 24px;">
      <h2 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#667eea;font-weight:700;border-bottom:1px solid #2d3748;padding-bottom:8px;">${esc(title)}</h2>
      ${body}
    </div>`;
}

function renderUpgradeCTA() {
  return `
    <div style="text-align:center;padding:24px 20px;background:#1a2744;border-radius:8px;margin:24px 0 0;">
      <p style="margin:0 0 6px;color:#a0aec0;font-size:13px;">You're on the free plan</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:15px;font-weight:600;">Upgrade to Pro for full briefings, social feeds, unlimited locations &amp; more.</p>
      <a href="https://mydailybriefing.app/pricing"
         style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:6px;letter-spacing:0.3px;">
        Upgrade to Pro &rarr;
      </a>
    </div>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build the complete HTML email string.
 *
 * @param {object} options
 * @param {string} options.date          - Human-readable date string for the subject line area
 * @param {string} options.userName      - First part of the email or display name
 * @param {string} options.location      - "City, State" string
 * @param {object} options.sections      - The `sections` object from the briefing API response
 * @param {object|null} options.morning_summary - AI morning summary object or string
 * @param {boolean} options.isPro        - Whether the user is a Pro subscriber
 * @returns {string} Full HTML email
 */
function buildEmailHtml({ date, userName, location, sections = {}, morning_summary = null, isPro = false }) {
  const greeting = userName ? `Good morning, ${esc(userName)}` : 'Good morning';
  const locationStr = location ? esc(location) : '';

  const body = [
    renderMorningSummary(morning_summary),
    renderWeather(sections.weather),
    renderMarkets(sections.markets),
    renderCalendar(sections.calendar),
    renderNewsList('Local News', sections.local_news),
    renderNewsList('National News', sections.national_news),
    renderSports(sections.sports),
    renderInterests(sections.interests),
    renderPolitics(sections.politics),
  ].filter(Boolean).join('\n');

  const ctaBlock = isPro ? '' : renderUpgradeCTA();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your Daily Briefing — ${esc(date)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your personalized briefing for ${esc(date)} is ready. ${locationStr ? `Today in ${locationStr}.` : ''}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f1117;">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Outer container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#171923;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1f35 0%,#0f1117 100%);padding:32px 32px 24px;border-bottom:1px solid #2d3748;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#667eea;font-weight:700;">mydailybriefing.app</p>
                    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#f7fafc;line-height:1.2;">${greeting}</h1>
                    <p style="margin:0;font-size:14px;color:#718096;">
                      ${esc(date)}${locationStr ? ` &middot; ${locationStr}` : ''}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${body}
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #2d3748;">
              <p style="margin:0 0 8px;font-size:12px;color:#4a5568;text-align:center;">
                You're receiving this because you signed up for a daily briefing at
                <a href="https://mydailybriefing.app" style="color:#667eea;text-decoration:none;">mydailybriefing.app</a>.
              </p>
              <p style="margin:0;font-size:12px;color:#4a5568;text-align:center;">
                <a href="https://mydailybriefing.app/settings" style="color:#718096;text-decoration:none;">Manage preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="https://mydailybriefing.app/unsubscribe" style="color:#718096;text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Outer container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

module.exports = { buildEmailHtml };
