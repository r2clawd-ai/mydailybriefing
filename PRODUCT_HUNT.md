# My Daily Briefing — Product Hunt Launch Draft

## Tagline (60 chars max)
Your town's news + X timeline + markets in one morning briefing

## Description (260 chars)
My Daily Briefing is a personalized morning briefing for people who aren't in New York City. Enter your ZIP code and get local news, weather, markets, high school sports, Reddit, and your X timeline — all in one clean front page. No algorithm. You control what you see.

## Full Listing Body

**The problem:** Apple News covers 20 cities. Everyone else is invisible.

If you live in Sioux Falls, Boise, Tulsa, or anywhere that isn't a top-20 market, you're getting zero local news from any major app. Apple News doesn't know your city. Flipboard doesn't know your ZIP code. Google News is an algorithm you can't control.

**What we built:**

My Daily Briefing is a personalized morning briefing — like a local Drudge Report — that actually knows where you live.

Enter your ZIP code and every morning you get:
- 📰 **Local news** from your city's TV stations and newspapers
- 🌤 **Weather** from the National Weather Service (your exact grid)
- 📈 **Markets** — your personal stock/crypto watchlist
- 🏛 **Politics** — your governor, state legislature, federal reps, county news
- 🏈 **Sports** — your teams + local high school sports
- 📡 **Social** — Reddit communities matched to your interests + your X timeline (connected via OAuth)
- 📧 **Newsletters** — any Substack or RSS feed you want to add
- 🏠 **Multiple locations** — home, work, family in another city

No app to download. Installs as a PWA. Works on any phone.

**Why it's different:**

Every other news app is a feed. This is a *briefing* — one screen, one morning, everything you need to know to start your day. Newspaper front page layout, not infinite scroll.

**The tech:**

Built on Node.js, Railway, SQLite. Local news pulled from TV station RSS feeds, Google News filtered by city/state, NWS weather grids. Reddit JSON API. X OAuth 2.0 for real timeline access.

**Pricing:**

14-day free trial → $7.99/month or $59/year. No app store cut.

---

## Maker Comment (post day-of)

Hi PH! I built this because I'm tired of morning news apps that only work if you live in NYC or LA.

I'm in Sioux Falls, SD. I want to know what's happening at the Sioux Falls city council, what the weather is at my NWS grid, how my local sports teams did last night, and what's trending on the finance subreddits — all before 8am.

No app did that. So I built one.

Would love to hear from anyone outside a major city — does your local news make it into Apple News? Mine doesn't. That's the gap we're filling.

---

## Target Communities
- Makers
- Productivity
- News & Journalism
- Local
- Developer Tools

## Launch Date Recommendation
**Tuesday** (highest PH traffic day)
Time: 12:01 AM PST (Sunday midnight → goes live Tuesday)

## Visuals Needed
- [ ] App screenshot: briefing front page (Sioux Falls 57103)
- [ ] App screenshot: onboarding step 1 (ZIP entry)
- [ ] App screenshot: Social section with Reddit posts
- [ ] GIF: typing ZIP → seeing local news load
- [ ] OG image: newspaper front page mockup with "YOUR TOWN" headline
