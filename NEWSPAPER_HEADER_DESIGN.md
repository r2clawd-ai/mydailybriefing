# Newspaper-Style Header Design

**Created:** Feb 6, 2026 3:35 PM CST  
**Inspired by:** The New York Times, Daily Mail, classic newspaper mastheads

---

## Visual Mockup

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Volume 1, No. 42        Thursday, February 6, 2026    │
│  ═══════════════════════════════════════════════════   │
│                                                         │
│                THE DAILY BRIEFING                       │
│                SIOUX FALLS EDITION                      │
│                                                         │
│  ═══════════════════════════════════════════════════   │
│  "All the News Worth Knowing"    High 28°F, Low 18°F   │
│  ─────────────────────────────────────────────────────  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Classic Newspaper Aesthetics

**Elements borrowed from The New York Times:**
- Volume and issue number (top left)
- Full date (top right)
- Bold, uppercase masthead (center)
- Decorative borders (thick horizontal lines)
- Serif-style typography (bold, large)
- Tagline in italics

**Elements borrowed from Daily Mail:**
- City edition name (LONDON EDITION → SIOUX FALLS EDITION)
- Weather in header (practical, daily info)
- Dense information layout (no wasted space)

---

## Typography Hierarchy

### 1. Masthead (Main Title)
```typescript
fontSize: 38pt
fontWeight: 800 (Extra Bold)
letterSpacing: 2
color: #1A1A1A (near black)
```

**Why:**
- Large enough to feel authoritative
- Bold enough to be the visual anchor
- Letter-spacing gives it gravitas (like carved stone)

### 2. City Edition
```typescript
fontSize: 13pt
fontWeight: 600 (Semibold)
letterSpacing: 2.5
color: #666666 (secondary gray)
```

**Why:**
- Smaller than masthead (clear hierarchy)
- All caps + letter-spacing = formal, official
- Gray color subordinates it to main title

### 3. Volume & Date
```typescript
fontSize: 11pt
fontWeight: 400 (Regular)
letterSpacing: 0.5
color: #999999 (tertiary gray)
```

**Why:**
- Small, functional info (not decorative)
- Flanking layout (volume left, date right) balances the header
- Subtle color (doesn't compete with masthead)

### 4. Tagline
```typescript
fontSize: 11pt
fontStyle: italic
color: #666666
```

**Why:**
- Italic = literary, editorial voice
- "All the News Worth Knowing" = playful nod to NYT's "All the News That's Fit to Print"
- Small, secondary info (flavor, not function)

---

## Borders & Spacing

### Triple Border System

**Top Border:**
- Height: 3px (thick, authoritative)
- Color: Black (#1A1A1A)
- Purpose: Separates metadata from masthead

**Bottom Border:**
- Height: 3px (matches top)
- Color: Black
- Purpose: Frames the masthead (creates visual box)

**Final Separator:**
- Height: 1px (subtle divider)
- Color: Light gray (#E5E5E5)
- Purpose: Transitions from header to content

**Why thick borders?**
- Newspapers used printing plates with heavy ink
- Thick borders = authoritative, established
- Creates visual "frame" around the masthead

---

## Layout Structure

```
┌────────────────────────────────────────┐
│ [Volume]              [Date]           │  ← Small, balanced
│ ════════════════════════════════       │  ← Thick border
│                                        │
│       [MASTHEAD - LARGE & BOLD]        │  ← Hero element
│       [City Edition - smaller]         │  ← Supporting info
│                                        │
│ ════════════════════════════════       │  ← Thick border
│ [Tagline]               [Weather]      │  ← Functional info
│ ────────────────────────────────       │  ← Subtle separator
└────────────────────────────────────────┘
```

**Why this structure?**
- **Symmetrical balance** - Volume/Date flanking, Tagline/Weather flanking
- **Clear hierarchy** - Masthead is unmistakably the hero
- **Functional info placement** - Weather top-right (where people look for it)
- **Breathing room** - Padding between elements (not cramped)

---

## Comparison to Original Header

### Before (Generic App Header)
```
📰 MY DAILY BRIEFING
Sioux Falls Edition
Thursday, February 6, 2026
High 28°F, Low 18°F • Mostly Cloudy
```

**Issues:**
- Generic, could be any app
- Emoji feels casual (not authoritative)
- No visual hierarchy (all similar sizes)
- No decorative elements (plain)

### After (Newspaper Masthead)
```
Volume 1, No. 42        Thursday, February 6, 2026
═══════════════════════════════════════════════════

                THE DAILY BRIEFING
                SIOUX FALLS EDITION

═══════════════════════════════════════════════════
"All the News Worth Knowing"    High 28°F, Low 18°F
───────────────────────────────────────────────────
```

**Improvements:**
- Instantly recognizable as newspaper
- Strong visual identity (not generic)
- Clear hierarchy (masthead dominates)
- Functional (volume, date, weather all present)
- Authoritative (thick borders, bold type)

---

## Why This Works for "My Daily Briefing"

### 1. Sets the Tone
- **Newspaper aesthetic** → This is serious, curated news
- **Not social media** → Finite, intentional reading
- **Authoritative** → You can trust this information

### 2. Creates Anticipation
- **Daily publication** → Like waiting for the morning paper
- **Volume number** → Builds a sense of collection (Vol. 365 feels special)
- **Edition name** → Personalized (YOUR city's news)

### 3. Differentiates from Competitors
- **Flipboard** - Magazine aesthetic (glossy, colorful)
- **Apple News** - Minimal, iOS-native
- **SmartNews** - Generic app UI
- **Us** - **Classic newspaper** (timeless, authoritative)

---

## Customization Options

### User Preferences (Future)

**1. Masthead Style:**
- Classic (serif, bold) ← Default
- Modern (sans-serif, clean)
- Retro (typewriter, monospace)

**2. City Edition:**
- Full name: "SIOUX FALLS EDITION"
- Short name: "SIOUX FALLS"
- None (hide it)

**3. Tagline:**
- Classic: "All the News Worth Knowing"
- Personal: "Your Daily Briefing"
- Custom: User sets their own
- None (hide it)

**4. Volume Display:**
- Actual count (Vol. 1, No. 42)
- Date-based (since launch)
- None (hide it)

---

## Technical Implementation

### Component Props
```typescript
interface NewspaperHeaderProps {
  city?: string;           // "Sioux Falls"
  date?: string;           // Auto-generates if not provided
  weather?: string;        // "High 28°F, Low 18°F"
  volume?: string;         // "Vol. 1, No. 42"
}
```

### Usage
```typescript
<NewspaperHeader
  city="Sioux Falls"
  weather="High 28°F, Low 18°F • Mostly Cloudy"
  volume="Vol. 1, No. 42"
/>
```

### Future Enhancements

**1. Custom Fonts**
- Load Playfair Display (serif, elegant)
- Load Old English Text MT (traditional newspaper)
- Load Libre Baskerville (readable serif)

**2. Dynamic Borders**
- Ornamental borders (fleur-de-lis corners)
- Geographic borders (state outline)
- Seasonal decorations (holidays)

**3. Animations**
- Fade in on load (like ink drying)
- Typewriter effect on first launch
- Daily "newspaper unfold" animation

---

## References & Inspiration

### The New York Times
- **Masthead:** All caps, bold, centered
- **"All the News That's Fit to Print"** - Our tagline homage
- **Volume/Issue number** - Track publication history

### Daily Mail
- **City edition naming** - LONDON EDITION
- **Weather in header** - Practical daily info
- **Bold borders** - Thick lines frame content

### Wall Street Journal
- **Understated elegance** - No color, pure typography
- **Information density** - Every element serves a purpose

### Classic Letterpress Printing
- **Thick borders** - Heavy ink, printing plate aesthetic
- **Letter-spacing** - Mimics metal type spacing
- **Hierarchy** - Physical size = visual importance

---

## Next Steps

**Immediate:**
- ✅ Component built (NewspaperHeader.tsx)
- ✅ Integrated into BriefingScreen
- 🔄 Test in iOS simulator

**Short-term:**
- [ ] Load custom serif font (Playfair Display)
- [ ] Add ornamental corners (optional decoration)
- [ ] Dynamic volume calculation (days since launch)

**Long-term:**
- [ ] User customization (masthead style, tagline)
- [ ] Animated "newspaper unfold" on first daily load
- [ ] Seasonal header variants (holidays, special events)

---

**Status:** Newspaper header complete! ✅  
**Look:** Classic NYT/Daily Mail masthead with thick borders, bold typography, and authoritative layout  
**Next:** Run the app to see it in action!
