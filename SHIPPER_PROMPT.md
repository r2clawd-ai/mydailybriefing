# MY DAILY BRIEFING - SHIPPER BUILD PROMPT

**Platform:** Shipper (Claude Opus 4.6)  
**Target:** iOS first, Android second  
**Design Reference:** `/Users/r2/.openclaw/workspace/DESIGN_SYSTEM.md`  
**Created:** Feb 12, 2026

---

## PROMPT FOR SHIPPER

```
Create a mobile app called "My Daily Briefing" - a CNBC-style morning briefing app that delivers financial markets, weather, calendar, and news in 3 minutes.

TARGET PLATFORM: iOS first (iPhone), then Android

DESIGN SYSTEM:
- Apple minimalism + Tesla boldness + CNBC authority
- Colors: Background #F5F5F7, Cards #FFFFFF, Accent #FF6B35, Green #10B981 (gains), Red #EF4444 (losses)
- Typography: SF Pro Display (headlines), SF Pro Text (body), SF Mono (numbers)
- Spacing: 8pt grid system, 16px screen margins, 24px section gaps
- Components: Card-based layout, generous white space

APP STRUCTURE:

HOME SCREEN:
1. Personalized Greeting
   - Time-aware: "Good morning/afternoon/evening, [Name]"
   - 28pt bold, #1A1A1A

2. Streak Badge
   - Shows daily reading streak: "📰 Day 21: In The Know"
   - Orange pill badge (#FF6B35), white text
   - 10 tiers: Day 1 (First Edition) → Day 365 (Enlightened)

3. Markets Section
   - Header: "📊 MARKETS" (28pt bold)
   - 3 market cards: S&P 500, Bitcoin, Oil
   - Each card shows:
     * Ticker (18pt monospace)
     * Current price (18pt bold)
     * Change: +$X.XX (+X.XX%) in green or red
     * Sparkline chart (small trend visualization)
   - White cards, 12px border radius, subtle shadow

4. Weather Section
   - Header: "⛅ WEATHER" (28pt bold)
   - Single weather widget with gradient background (orange to amber, 10% opacity)
   - Shows: Temperature (48pt bold), condition (emoji + text), feels like, humidity, wind
   - Location: User's current city

5. Calendar Section
   - Header: "📅 TODAY'S CALENDAR" (28pt bold)
   - List of events for today
   - Each event: Time (blue), title (bold), location icon + duration
   - Blue-tinted cards with left border accent

6. News Section
   - Header: "📰 BREAKING NEWS" (28pt bold)
   - 3-5 news cards
   - Each card: Thumbnail image (16:9), headline (20pt semibold), 2-line summary, source + time
   - White cards, top image bleeds to card edges

ANIMATIONS:
1. Opening Animation (First Launch):
   - Vintage newspaper spiraling into view (5 seconds)
   - NYT-style blackletter font, "EXTRA! EXTRA!" masthead
   - Rotate 1080 degrees while scaling from 0.2x to 1.0x
   - One stable joke headline (no cycling)

2. Card Entry:
   - Cards slide up with fade-in (300ms)
   - Staggered by 100ms between cards
   - Smooth ease-out animation

3. Badge Unlock:
   - When earning new badge: Scale from 0 with rotation, bounce effect
   - Confetti particles for milestone badges (Day 7, 21, 30, 100, 365)

NAVIGATION:
- Bottom tab bar (iOS) with 5 sections:
  * Home (house icon) - Main briefing
  * Markets (chart icon) - Detailed market data
  * News (newspaper icon) - Full news feed
  * Settings (gear icon) - Preferences
  * Profile (person icon) - User stats + streak

DATA SOURCES (PLACEHOLDER):
- Markets: Mock data (S&P 500: $4,850, Bitcoin: $97,500, Oil: $78/bbl)
- Weather: Mock data (Sioux Falls, 72°F, Sunny)
- Calendar: Mock events (9:30 AM Team Sync, 2:00 PM Client Call)
- News: Mock headlines (Fed news, Tech stocks, etc.)

FEATURES:
1. Pull to Refresh
   - Spinning newspaper icon during refresh
   - Haptic feedback on trigger

2. Dark Mode Support
   - Invert colors: Background #1A1A1A, Cards #2A2A2A
   - Adjust opacity for readability

3. Favorite Articles
   - Heart icon on news cards
   - Save to favorites tab
   - Stored locally (AsyncStorage)

4. Share Functionality
   - Share button on articles
   - Native iOS share sheet

5. Settings Screen:
   - Name input (for personalized greeting)
   - Notification time picker (default 6:45 AM)
   - Dark mode toggle
   - Location picker (for weather)

TECHNICAL REQUIREMENTS:
- React Native or native Swift/SwiftUI (your choice)
- Minimum iOS 14, Android 10
- Offline support: Cache last briefing
- Push notifications: Daily at user-selected time
- Local storage: AsyncStorage or Core Data

APP STORE LISTING (Auto-generate):
- Icon: Newspaper with orange accent (modern, clean)
- Name: "My Daily Briefing"
- Tagline: "Your 3-minute morning intelligence"
- Description: Professional morning briefing with markets, weather, and news
- Keywords: news, briefing, morning, markets, stocks, weather, calendar, finance, CNBC
- Category: News
- Screenshots: 6.5" iPhone, 12.9" iPad

DESIGN NOTES:
- Generous white space (30-35% of screen)
- Single accent color (#FF6B35) - no rainbow chaos
- F-pattern reading flow (top-left priority)
- Scannable in 3 minutes max
- Professional tone, data-driven

EDGE CASES:
- No internet: Show cached briefing + "Offline" banner
- Empty calendar: Show "No events today" state
- No news: Show "Check back later" message
- First launch: Show onboarding (3 slides: "Markets", "Your Day", "Stay Informed")

ACCESSIBILITY:
- Minimum 14pt font for body text
- 44x44pt touch targets
- VoiceOver support (descriptive labels)
- Dynamic Type support
- Minimum 4.5:1 contrast ratio

POLISH:
- Smooth scrolling (60fps)
- Loading skeletons (shimmer effect)
- Error states with retry button
- Empty states with friendly illustrations

PLEASE BUILD:
1. iOS app with all features above
2. Working prototype with mock data
3. App Store listing materials
4. Submit-ready package

STYLE REFERENCE:
Think Apple News meets Bloomberg Terminal meets CNBC app. Clean, professional, fast.
```

---

## FOLLOW-UP PROMPTS (After Initial Build)

### If Needed: Design Refinements
```
Adjust the design system:
- Increase card shadows for better depth
- Make section headers bolder
- Adjust sparkline colors (green/red for up/down)
- Add more padding around numbers for breathing room
```

### If Needed: Feature Additions
```
Add these features:
- Search functionality (news + market symbols)
- Custom watchlist (add/remove stocks)
- Weather alerts (push notifications)
- Export briefing to PDF
```

### If Needed: Performance Optimization
```
Optimize performance:
- Lazy load images
- Virtualized lists for news feed
- Reduce animation complexity
- Cache network requests
```

---

## TESTING CHECKLIST

After Shipper builds the app, verify:

- [ ] Opening animation plays smoothly
- [ ] Cards load with staggered animation
- [ ] Market cards show correct colors (green/red)
- [ ] Weather widget displays location + temp
- [ ] Calendar events show time + title
- [ ] News cards have images + headlines
- [ ] Bottom navigation switches screens
- [ ] Pull to refresh works
- [ ] Dark mode toggles properly
- [ ] Badge system increments on daily open
- [ ] Favorites save/load correctly
- [ ] Share button opens iOS share sheet
- [ ] Settings persist across app restarts
- [ ] Offline mode shows cached briefing
- [ ] Push notifications fire at set time

---

## POST-BUILD: CONNECT TO REAL DATA

Once app is built, wire up real APIs:

**Markets:**
```javascript
// Yahoo Finance API (free, no auth)
const marketUrl = (symbol) => 
  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`;
```

**Weather:**
```javascript
// OpenWeatherMap API (free tier: 1K calls/day)
const weatherUrl = (lat, lon) => 
  `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=YOUR_KEY`;
```

**News:**
```javascript
// NewsAPI (free tier: 100 req/day)
const newsUrl = `https://newsapi.org/v2/top-headlines?country=us&apiKey=YOUR_KEY`;
```

**Calendar:**
```javascript
// Google Calendar API
// Or local device calendar via react-native-calendar-events
```

---

## DEPLOYMENT CHECKLIST

Before submitting to App Store:

- [ ] Update app icon (1024x1024)
- [ ] Create 6 screenshots (6.5" iPhone)
- [ ] Write App Store description
- [ ] Set keywords (max 100 chars)
- [ ] Add privacy policy URL
- [ ] Configure push notification entitlements
- [ ] Test on physical device
- [ ] Run app through Xcode Analyzer
- [ ] Fix all warnings
- [ ] Submit for review

---

## ESTIMATED TIMELINE

**Shipper Build:** 5 minutes  
**Testing:** 30 minutes  
**API Integration:** 2 hours  
**App Store Submission:** 1 hour  
**Review Time:** 24-48 hours  

**Total to Live:** ~3-4 days from start to App Store approval

---

**Last Updated:** Feb 12, 2026  
**Status:** Ready for Shipper  
**Next Step:** Submit prompt to Shipper platform
