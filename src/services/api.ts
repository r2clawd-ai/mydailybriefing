/**
 * Briefing API service
 * Handles all communication with the backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Update this to your deployed backend URL in production
const API_BASE = __DEV__ ? 'http://localhost:3001' : 'https://api.mydailybriefing.app';

const TOKEN_KEY = '@briefing:token';

// ── Auth ──────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ── User ──────────────────────────────────────────────────────────

export interface SignupPayload {
  email: string;
  zip_code: string;
  interests?: string[];
  sports_teams?: string[];
  hs_teams?: string[];
  celeb_topics?: string[];
  twitter_handles?: string[];
  stocks?: string[];
}

export async function signUp(payload: SignupPayload): Promise<{ token: string; profile: UserProfile }> {
  const res = await fetch(`${API_BASE}/api/users/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.token) throw new Error(data.error || 'Signup failed');
  await setToken(data.token);
  return { token: data.token, profile: data.profile };
}

export interface UserProfile {
  id: string;
  email: string;
  zip_code: string;
  city?: string;
  state?: string;
  interests: string[];
  sports_teams: string[];
  hs_teams: string[];
  twitter_handles: string[];
  stocks: string[];
}

export async function getProfile(): Promise<UserProfile | null> {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/api/users/${token}/profile`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE}/api/users/${token}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

// ── Geo ───────────────────────────────────────────────────────────

export interface GeoResult {
  city: string;
  state: string;
  lat: number;
  lng: number;
  displayName: string;
}

export async function resolveZip(zip: string): Promise<GeoResult> {
  const res = await fetch(`${API_BASE}/api/geo/zip/${zip}`);
  if (!res.ok) throw new Error('Invalid ZIP code');
  return res.json();
}

export interface School {
  name: string;
  mascot: string;
  classification: string;
}

export async function getNearbySchools(city: string): Promise<School[]> {
  const res = await fetch(`${API_BASE}/api/geo/schools/${encodeURIComponent(city)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.schools || [];
}

// ── Briefing ──────────────────────────────────────────────────────

export interface WeatherPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast?: string;
  action?: string;
}

export interface MarketItem {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  direction: string;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  pubDate?: string;
  type?: string;
}

export interface PoliticsRep {
  name: string;
  party: string;
  chamber: string;
  district?: string;
  phone?: string;
  url?: string;
}

export interface LocalAccount {
  handle?: string;
  name: string;
  platform: string;
  url?: string;
}

export interface BriefingData {
  generated_at: string;
  user: { email: string; location: string };
  sections: {
    weather?: {
      current: WeatherPeriod;
      tonight?: WeatherPeriod;
      tomorrow?: WeatherPeriod;
      periods: WeatherPeriod[];
    };
    markets: MarketItem[];
    national_news: NewsItem[];
    local_news: NewsItem[];
    sports: NewsItem[];
    interests: NewsItem[];
    local_accounts: {
      news: LocalAccount[];
      gov: LocalAccount[];
      weather: LocalAccount[];
      sports: LocalAccount[];
      community: LocalAccount[];
    };
    suggested_accounts: (LocalAccount & { reason: string })[];
    hyper_local: {
      community_pulse: NewsItem[];
      events: NewsItem[];
      civic: NewsItem[];
      local_business: NewsItem[];
      alerts: { title: string; severity: string; urgency: string; expires: string }[];
    };
    politics: {
      federal_reps: PoliticsRep[];
      federal_news: NewsItem[];
      governor?: { name: string; party: string; state: string };
      governor_news: NewsItem[];
      state_legislature: NewsItem[];
      county: NewsItem[];
    };
    hs_sports: {
      school_news: NewsItem[];
      state_sports: NewsItem[];
      nearby_schools: School[];
    };
  };
}

export async function getBriefing(): Promise<BriefingData> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE}/api/users/${token}/briefing`);
  if (!res.ok) throw new Error('Failed to load briefing');
  return res.json();
}
