/**
 * seo.js — City-specific SEO landing pages
 * GET /cities/:city-state → rendered HTML page for that city
 * GET /sitemap-cities.xml → city sitemap
 */

// Top 50 US cities for SEO targeting
const SEO_CITIES = [
  { slug: 'sioux-falls-sd', city: 'Sioux Falls', state: 'SD', zip: '57104', pop: '200K' },
  { slug: 'new-york-ny', city: 'New York', state: 'NY', zip: '10001', pop: '8.3M' },
  { slug: 'los-angeles-ca', city: 'Los Angeles', state: 'CA', zip: '90001', pop: '3.9M' },
  { slug: 'chicago-il', city: 'Chicago', state: 'IL', zip: '60601', pop: '2.7M' },
  { slug: 'houston-tx', city: 'Houston', state: 'TX', zip: '77001', pop: '2.3M' },
  { slug: 'phoenix-az', city: 'Phoenix', state: 'AZ', zip: '85001', pop: '1.6M' },
  { slug: 'philadelphia-pa', city: 'Philadelphia', state: 'PA', zip: '19101', pop: '1.6M' },
  { slug: 'san-antonio-tx', city: 'San Antonio', state: 'TX', zip: '78201', pop: '1.4M' },
  { slug: 'san-diego-ca', city: 'San Diego', state: 'CA', zip: '92101', pop: '1.4M' },
  { slug: 'dallas-tx', city: 'Dallas', state: 'TX', zip: '75201', pop: '1.3M' },
  { slug: 'denver-co', city: 'Denver', state: 'CO', zip: '80201', pop: '715K' },
  { slug: 'austin-tx', city: 'Austin', state: 'TX', zip: '73301', pop: '978K' },
  { slug: 'nashville-tn', city: 'Nashville', state: 'TN', zip: '37201', pop: '689K' },
  { slug: 'minneapolis-mn', city: 'Minneapolis', state: 'MN', zip: '55401', pop: '429K' },
  { slug: 'portland-or', city: 'Portland', state: 'OR', zip: '97201', pop: '652K' },
  { slug: 'kansas-city-mo', city: 'Kansas City', state: 'MO', zip: '64101', pop: '508K' },
  { slug: 'omaha-ne', city: 'Omaha', state: 'NE', zip: '68101', pop: '486K' },
  { slug: 'rapid-city-sd', city: 'Rapid City', state: 'SD', zip: '57701', pop: '75K' },
  { slug: 'fargo-nd', city: 'Fargo', state: 'ND', zip: '58101', pop: '125K' },
  { slug: 'des-moines-ia', city: 'Des Moines', state: 'IA', zip: '50301', pop: '215K' },
];

function renderCityPage(cityData) {
  const { city, state, zip, pop, slug } = cityData;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Morning Briefing for ${city}, ${state} — My Daily Briefing</title>
  <meta name="description" content="Get a personalized morning briefing for ${city}, ${state}. Local news, weather, markets, and community updates — delivered every morning. Free to try." />
  <meta name="keywords" content="${city} local news, ${city} morning briefing, ${city} ${state} news, ${city} weather today, local news ${city}" />
  <link rel="canonical" href="https://mydailybriefing.app/cities/${slug}" />
  <meta property="og:title" content="Morning Briefing for ${city}, ${state}" />
  <meta property="og:description" content="Personalized local news, weather, and markets for ${city}. Updated every morning." />
  <meta property="og:url" content="https://mydailybriefing.app/cities/${slug}" />
  <meta property="og:type" content="website" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #f5f5f5; }
    .hero { max-width: 720px; margin: 0 auto; padding: 80px 24px 60px; text-align: center; }
    .badge { display: inline-block; background: #1a1a2e; color: #6c8ebf; font-size: 13px; padding: 6px 16px; border-radius: 99px; margin-bottom: 24px; border: 1px solid #2a2a4e; }
    h1 { font-size: clamp(28px, 5vw, 48px); font-weight: 800; line-height: 1.15; margin-bottom: 20px; }
    h1 em { font-style: normal; color: #4a9eff; }
    .sub { font-size: 18px; color: #aaa; line-height: 1.6; max-width: 500px; margin: 0 auto 40px; }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; max-width: 720px; margin: 0 auto 48px; padding: 0 24px; }
    .feature { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; text-align: left; }
    .feature .icon { font-size: 24px; margin-bottom: 10px; }
    .feature h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
    .feature p { font-size: 13px; color: #888; line-height: 1.5; }
    .cta-section { max-width: 480px; margin: 0 auto; padding: 0 24px 80px; text-align: center; }
    .cta-form { display: flex; gap: 10px; margin-bottom: 16px; }
    .cta-form input { flex: 1; padding: 14px 16px; border-radius: 10px; border: 1px solid #2a2a2a; background: #1a1a1a; color: #fff; font-size: 15px; }
    .cta-form button { padding: 14px 24px; background: #4a9eff; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .cta-form button:hover { background: #3a8ef0; }
    .cta-note { font-size: 13px; color: #666; }
    .success { display: none; background: #1a3a1a; border: 1px solid #2a5a2a; border-radius: 10px; padding: 16px; color: #4ade80; }
    .breadcrumb { max-width: 720px; margin: 0 auto; padding: 20px 24px 0; font-size: 13px; color: #666; }
    .breadcrumb a { color: #4a9eff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="breadcrumb">
    <a href="/">My Daily Briefing</a> → ${state} → ${city}
  </div>
  <div class="hero">
    <div class="badge">📍 ${city}, ${state}</div>
    <h1>The morning briefing<br><em>${city}</em> deserves.</h1>
    <p class="sub">Local news from ${city}, today's weather, your markets, and what's happening in your community — delivered every morning before 7 AM.</p>
  </div>
  <div class="features">
    <div class="feature">
      <div class="icon">📰</div>
      <h3>${city} Local News</h3>
      <p>Stories from local outlets, not national headlines that ignore your city.</p>
    </div>
    <div class="feature">
      <div class="icon">🌤️</div>
      <h3>Hyper-local Weather</h3>
      <p>Today's forecast and what to expect this week in ${city}.</p>
    </div>
    <div class="feature">
      <div class="icon">📊</div>
      <h3>Markets & Stocks</h3>
      <p>The stocks and indices you care about, updated daily.</p>
    </div>
    <div class="feature">
      <div class="icon">🏛️</div>
      <h3>${state} Politics</h3>
      <p>Your representatives, local races, and what's moving in Pierre.</p>
    </div>
    <div class="feature">
      <div class="icon">🏟️</div>
      <h3>Sports</h3>
      <p>Scores, schedules, and stories for the teams you follow.</p>
    </div>
    <div class="feature">
      <div class="icon">🏘️</div>
      <h3>Community</h3>
      <p>Events, obituaries, local business news, and neighborhood updates.</p>
    </div>
  </div>
  <div class="cta-section">
    <div class="cta-form">
      <input type="email" id="emailInput" placeholder="your@email.com" />
      <button onclick="joinWaitlist()">Get My Briefing</button>
    </div>
    <div class="cta-note">Free to start • No credit card • Takes 60 seconds to set up</div>
    <div class="success" id="successMsg">✅ You're in! Check your email for setup instructions.</div>
  </div>

  <script>
    const API = window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://mydailybriefing-api-production.up.railway.app';
    async function joinWaitlist() {
      const email = document.getElementById('emailInput').value.trim();
      if (!email || !email.includes('@')) {
        document.getElementById('emailInput').focus();
        return;
      }
      try {
        const res = await fetch(API + '/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, zip_code: '${zip}', source: 'city-page-${slug}' })
        });
        const d = await res.json();
        if (d.status === 'already_registered') {
          window.location.href = '/?email=' + encodeURIComponent(email);
        } else {
          document.querySelector('.cta-form').style.display = 'none';
          document.getElementById('successMsg').style.display = 'block';
        }
      } catch(e) {
        alert('Something went wrong. Try again.');
      }
    }
    document.getElementById('emailInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') joinWaitlist();
    });
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "My Daily Briefing — ${city}, ${state}",
    "description": "Personalized morning news briefing for ${city}, ${state}",
    "url": "https://mydailybriefing.app/cities/${slug}",
    "applicationCategory": "NewsApplication",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "areaServed": { "@type": "City", "name": "${city}", "containedInPlace": { "@type": "State", "name": "${state}" } }
  }
  </script>
</body>
</html>`;
}

module.exports = { SEO_CITIES, renderCityPage };
