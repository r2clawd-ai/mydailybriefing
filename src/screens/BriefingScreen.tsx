/**
 * BriefingScreen — the main daily read.
 * Pulls real data from the API. All 11 sections.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Linking,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getBriefing, getProfile, BriefingData, UserProfile } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Colors ──────────────────────────────────────────────────────────
const C = {
  bg:      '#0d0d0d',
  surface: '#161616',
  surface2:'#1e1e1e',
  border:  '#252525',
  border2: '#2e2e2e',
  accent:  '#f0c040',
  accent2: '#e07020',
  red:     '#e05050',
  green:   '#4db86a',
  blue:    '#4a9eff',
  text:    '#f0f0f0',
  text2:   '#b0b0b0',
  muted:   '#666666',
  teal:    '#4ecdc4',
};

// ── Helpers ─────────────────────────────────────────────────────────
function weatherIcon(f: string = ''): string {
  const s = f.toLowerCase();
  if (s.includes('snow') || s.includes('sleet'))  return '❄️';
  if (s.includes('thunder') || s.includes('storm')) return '⛈️';
  if (s.includes('rain') || s.includes('shower'))   return '🌧️';
  if (s.includes('fog'))                             return '🌫️';
  if (s.includes('overcast'))                        return '☁️';
  if (s.includes('cloud'))                           return '⛅';
  if (s.includes('wind'))                            return '💨';
  if (s.includes('clear') || s.includes('sunny'))    return '☀️';
  return '🌤️';
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
    if (diff < 60)   return `${Math.round(diff)}m ago`;
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
    return `${Math.round(diff / 1440)}d ago`;
  } catch { return ''; }
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Sub-components ──────────────────────────────────────────────────

const SectionHeader = ({ title, meta }: { title: string; meta?: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
  </View>
);

const NewsCard = ({
  title, source, pubDate, url, badgeLabel, badgeColor,
}: {
  title: string; source?: string; pubDate?: string;
  url?: string; badgeLabel: string; badgeColor: string;
}) => (
  <TouchableOpacity
    style={styles.newsCard}
    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (url) Linking.openURL(url); }}
    activeOpacity={0.75}
  >
    <View style={styles.newsCardBody}>
      <View style={[styles.badge, { backgroundColor: badgeColor + '22' }]}>
        <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
      </View>
      <Text style={styles.newsHeadline}>{title}</Text>
      <View style={styles.newsMeta}>
        {source ? <Text style={styles.newsSource}>{source}</Text> : null}
        {pubDate ? <Text style={styles.newsTime}>{timeAgo(pubDate)}</Text> : null}
      </View>
    </View>
    <Text style={styles.newsChevron}>›</Text>
  </TouchableOpacity>
);

const MarketCard = ({ symbol, price, change_pct }: { symbol: string; price: number; change_pct: number }) => {
  const isUp = change_pct >= 0;
  const sym  = symbol.replace('-USD','').replace('^','');
  const priceStr = sym === 'BTC' || sym === 'ETH'
    ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : symbol.startsWith('^')
      ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : `$${price.toFixed(2)}`;

  return (
    <TouchableOpacity style={styles.marketCard} activeOpacity={0.8}>
      <Text style={styles.marketSym}>{sym}</Text>
      <Text style={styles.marketPrice}>{priceStr}</Text>
      <Text style={[styles.marketChange, { color: isUp ? C.green : C.red }]}>
        {isUp ? '▲' : '▼'} {Math.abs(change_pct).toFixed(2)}%
      </Text>
    </TouchableOpacity>
  );
};

const RepCard = ({ role, name, party, district }: { role: string; name: string; party: string; district?: string }) => (
  <View style={styles.repCard}>
    <Text style={styles.repRole}>{role}{district ? ` · Dist. ${district}` : ''}</Text>
    <Text style={styles.repName}>{name}</Text>
    <Text style={[styles.repParty, { color: party === 'Republican' ? C.red : C.blue }]}>
      {party === 'Republican' ? '🔴 Republican' : party === 'Democratic' ? '🔵 Democrat' : party}
    </Text>
  </View>
);

const AccountChip = ({ handle, name, platform, url }: any) => (
  <TouchableOpacity
    style={styles.accountChip}
    onPress={() => url && Linking.openURL(url)}
    activeOpacity={0.7}
  >
    <Text style={styles.accountHandle}>{handle || name}</Text>
    <Text style={styles.accountPlatform}>{platform}</Text>
  </TouchableOpacity>
);

// ── Weather card with expandable 7-day ──────────────────────────────
const WeatherCard = ({ weather }: { weather: BriefingData['sections']['weather'] }) => {
  const [expanded, setExpanded] = useState(false);
  if (!weather?.current) return null;
  const cur = weather.current;

  return (
    <TouchableOpacity
      style={styles.weatherCard}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(e => !e);
      }}
      activeOpacity={0.9}
    >
      <View style={styles.weatherMain}>
        <View>
          <Text style={styles.weatherTemp}>
            {cur.temperature}
            <Text style={styles.weatherUnit}>°{cur.temperatureUnit}</Text>
          </Text>
          <Text style={styles.weatherName}>{cur.name}</Text>
          <Text style={styles.weatherDesc}>{cur.shortForecast}</Text>
        </View>
        <Text style={styles.weatherIcon}>{weatherIcon(cur.shortForecast)}</Text>
      </View>

      {cur.action ? (
        <View style={styles.actionBanner}>
          <Text style={styles.actionText}>{cur.action}</Text>
        </View>
      ) : null}

      <View style={styles.forecastToggle}>
        <Text style={styles.forecastToggleText}>7-day forecast</Text>
        <Text style={[styles.forecastToggleIcon, expanded && { transform: [{ rotate: '180deg' }] }]}>↓</Text>
      </View>

      {expanded && (
        <View style={styles.forecast7day}>
          {(weather.periods || []).map((p, i) => (
            <View key={i} style={styles.forecastRow}>
              <Text style={styles.forecastDay}>{p.name}</Text>
              <Text style={styles.forecastIcon}>{weatherIcon(p.shortForecast)}</Text>
              <Text style={styles.forecastDesc} numberOfLines={1}>{p.shortForecast}</Text>
              <Text style={styles.forecastTemp}>{p.temperature}°{p.temperatureUnit}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Main screen ──────────────────────────────────────────────────────
interface BriefingScreenProps {
  onSignOut: () => void;
}

export const BriefingScreen: React.FC<BriefingScreenProps> = ({ onSignOut }) => {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [b, p] = await Promise.all([getBriefing(), getProfile()]);
      setBriefing(b);
      if (p) setProfile(p);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    load(true);
  };

  if (loading) {
    return (
      <View style={[styles.shell, styles.centered]}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={[styles.muted, { marginTop: 16 }]}>Loading your briefing…</Text>
      </View>
    );
  }

  if (error || !briefing) {
    return (
      <View style={[styles.shell, styles.centered]}>
        <Text style={styles.errorText}>⚠️ {error || 'Something went wrong'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s   = briefing.sections;
  const loc = briefing.user?.location || (profile?.city ? `${profile.city}, ${profile.state}` : '');

  const now  = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mons = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateStr = `${days[now.getDay()]}, ${mons[now.getMonth()]} ${now.getDate()}`;

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerDate}>{dateStr}</Text>
          <Text style={styles.headerGreeting}>{greeting()}</Text>
          {loc ? <Text style={styles.headerLoc}>📍 {loc}</Text> : null}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        showsVerticalScrollIndicator={false}
      >

        {/* Weather */}
        <View style={styles.section}>
          <SectionHeader title="🌤 Weather" meta={loc} />
          <WeatherCard weather={s.weather} />

          {(s.hyper_local?.alerts || []).map((a, i) => (
            <View key={i} style={styles.alertCard}>
              <Text style={styles.alertTitle}>⚠️ {a.title}</Text>
              <Text style={styles.alertMeta}>Severity: {a.severity}</Text>
            </View>
          ))}
        </View>

        {/* Markets */}
        {s.markets?.length ? (
          <View style={styles.section}>
            <SectionHeader title="📈 Markets" meta="Live" />
            <View style={styles.marketsGrid}>
              {s.markets.map((m, i) => (
                <MarketCard key={i} symbol={m.symbol} price={m.price} change_pct={m.change_pct} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Local news */}
        {s.local_news?.length ? (
          <View style={styles.section}>
            <SectionHeader title="📍 Local" meta={loc} />
            {s.local_news.map((n, i) => (
              <NewsCard key={i} {...n} badgeLabel="Local" badgeColor={C.accent} />
            ))}
          </View>
        ) : null}

        {/* Community: civic + business + events */}
        {(s.hyper_local?.civic?.length || s.hyper_local?.local_business?.length || s.hyper_local?.events?.length) ? (
          <View style={styles.section}>
            <SectionHeader title="🏙 Community" meta="City · Neighborhood" />
            {s.hyper_local.civic?.length ? (
              <>
                <Text style={styles.subLabel}>City Government</Text>
                {s.hyper_local.civic.map((n, i) => (
                  <NewsCard key={i} {...n} badgeLabel="Civic" badgeColor={C.teal} />
                ))}
              </>
            ) : null}
            {s.hyper_local.local_business?.length ? (
              <>
                <Text style={[styles.subLabel, { marginTop: 12 }]}>Openings & Closings</Text>
                {s.hyper_local.local_business.map((n, i) => (
                  <NewsCard key={i} {...n} badgeLabel="Local" badgeColor={C.accent} />
                ))}
              </>
            ) : null}
            {s.hyper_local.events?.length ? (
              <>
                <Text style={[styles.subLabel, { marginTop: 12 }]}>This Week</Text>
                {s.hyper_local.events.slice(0, 3).map((n, i) => (
                  <NewsCard key={i} {...n} badgeLabel="Event" badgeColor={C.accent2} />
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {/* National */}
        {s.national_news?.length ? (
          <View style={styles.section}>
            <SectionHeader title="📰 National" meta="NPR" />
            {s.national_news.slice(0, 6).map((n, i) => (
              <NewsCard key={i} {...n} badgeLabel="National" badgeColor={C.blue} />
            ))}
          </View>
        ) : null}

        {/* Politics */}
        {(s.politics?.federal_reps?.length || s.politics?.governor) ? (
          <View style={styles.section}>
            <SectionHeader title="🏛 Politics" meta="Federal · State" />
            <View style={styles.repGrid}>
              {s.politics.governor ? (
                <RepCard role="Governor" name={s.politics.governor.name} party={s.politics.governor.party === 'R' ? 'Republican' : 'Democratic'} />
              ) : null}
              {(s.politics.federal_reps || []).map((r, i) => (
                <RepCard key={i} role={r.chamber} name={r.name} party={r.party} district={r.district} />
              ))}
            </View>
            {[...(s.politics.governor_news || []), ...(s.politics.state_legislature || []), ...(s.politics.federal_news || [])].slice(0, 5).map((n, i) => (
              <NewsCard key={i} {...n} badgeLabel="Politics" badgeColor={C.teal} />
            ))}
          </View>
        ) : null}

        {/* Sports */}
        {(s.sports?.length || s.hs_sports?.state_sports?.length) ? (
          <View style={styles.section}>
            <SectionHeader title="🏆 Sports" meta="Pro · HS" />
            {s.sports?.map((n, i) => (
              <NewsCard key={i} {...n} badgeLabel="Sports" badgeColor={C.green} />
            ))}
            {s.hs_sports?.state_sports?.length ? (
              <>
                <Text style={[styles.subLabel, { marginTop: 12 }]}>High School</Text>
                {s.hs_sports.state_sports.slice(0, 3).map((n, i) => (
                  <NewsCard key={i} {...n} badgeLabel="HS Sports" badgeColor={C.green} />
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {/* Interests */}
        {s.interests?.length ? (
          <View style={styles.section}>
            <SectionHeader title="💡 Your Topics" meta={(profile?.interests || []).join(' · ')} />
            {s.interests.slice(0, 6).map((n, i) => (
              <NewsCard key={i} {...n} badgeLabel="Topic" badgeColor={C.blue} />
            ))}
          </View>
        ) : null}

        {/* Accounts to follow */}
        {(() => {
          const la = s.local_accounts || {} as any;
          const all = [...(la.news||[]), ...(la.gov||[]), ...(la.weather||[]), ...(la.sports||[])];
          const sug = s.suggested_accounts || [];
          if (!all.length && !sug.length) return null;
          return (
            <View style={styles.section}>
              <SectionHeader title="👤 Worth Following" />
              {all.length ? (
                <>
                  <Text style={styles.subLabel}>In {loc}</Text>
                  <View style={styles.accountsWrap}>
                    {all.map((a: any, i: number) => <AccountChip key={i} {...a} />)}
                  </View>
                </>
              ) : null}
              {sug.length ? (
                <>
                  <Text style={[styles.subLabel, { marginTop: 14 }]}>By Interest</Text>
                  <View style={styles.accountsWrap}>
                    {sug.slice(0, 8).map((a: any, i: number) => <AccountChip key={i} {...a} />)}
                  </View>
                </>
              ) : null}
            </View>
          );
        })()}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  shell:   { flex: 1, backgroundColor: C.bg },
  centered:{ justifyContent: 'center', alignItems: 'center' },
  scroll:  { flex: 1 },
  scrollContent: { padding: 16 },

  header:        { padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: C.border },
  headerDate:    { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  headerGreeting:{ fontSize: 22, fontWeight: '800', color: C.text, marginTop: 2, letterSpacing: -0.5 },
  headerLoc:     { fontSize: 13, color: C.text2, marginTop: 4 },
  refreshBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, alignItems: 'center', justifyContent: 'center' },
  refreshIcon:   { fontSize: 18, color: C.accent },

  section:       { marginTop: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 14 },
  sectionTitle:  { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', color: C.accent },
  sectionMeta:   { fontSize: 11, color: C.muted },
  subLabel:      { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted, marginBottom: 8 },

  weatherCard:  { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: 12, padding: 20 },
  weatherMain:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weatherTemp:  { fontSize: 52, fontWeight: '800', color: C.text, letterSpacing: -2, lineHeight: 56 },
  weatherUnit:  { fontSize: 24, fontWeight: '400', color: C.muted },
  weatherIcon:  { fontSize: 48 },
  weatherName:  { fontSize: 14, fontWeight: '600', color: C.text2, marginTop: 4 },
  weatherDesc:  { fontSize: 13, color: C.muted, marginTop: 2 },
  actionBanner: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border2, borderRadius: 8, padding: 10, marginTop: 14 },
  actionText:   { fontSize: 13, color: C.accent, lineHeight: 20 },
  forecastToggle:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  forecastToggleText: { fontSize: 12, color: C.muted },
  forecastToggleIcon: { fontSize: 12, color: C.muted },
  forecast7day: { marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  forecastRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  forecastDay:  { width: 72, fontSize: 13, color: C.text2, fontWeight: '500' },
  forecastIcon: { width: 24, fontSize: 16, textAlign: 'center' },
  forecastDesc: { flex: 1, fontSize: 12, color: C.muted },
  forecastTemp: { fontSize: 13, fontWeight: '700', color: C.text },

  marketsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  marketCard:   { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: 10, padding: 14, minWidth: 130, flex: 1 },
  marketSym:    { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.5 },
  marketPrice:  { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 2, letterSpacing: -0.5 },
  marketChange: { fontSize: 12, fontWeight: '600', marginTop: 3 },

  newsCard:     { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  newsCardBody: { flex: 1 },
  badge:        { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, marginBottom: 6 },
  badgeText:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  newsHeadline: { fontSize: 14, fontWeight: '600', color: C.text, lineHeight: 20 },
  newsMeta:     { flexDirection: 'row', gap: 8, marginTop: 5 },
  newsSource:   { fontSize: 11, color: C.text2, fontWeight: '500' },
  newsTime:     { fontSize: 11, color: C.muted },
  newsChevron:  { fontSize: 20, color: C.muted },

  repGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  repCard:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: 10, padding: 14, minWidth: 150, flex: 1 },
  repRole:      { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted },
  repName:      { fontSize: 14, fontWeight: '700', color: C.text, marginTop: 3, lineHeight: 20 },
  repParty:     { fontSize: 12, marginTop: 4 },

  accountsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip:  { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: 100 },
  accountHandle:{ fontSize: 13, fontWeight: '500', color: C.text },
  accountPlatform:{ fontSize: 10, color: C.muted },

  alertCard:    { backgroundColor: 'rgba(224,80,80,.08)', borderWidth: 1, borderColor: 'rgba(224,80,80,.25)', borderRadius: 10, padding: 14, marginBottom: 8 },
  alertTitle:   { fontSize: 14, fontWeight: '700', color: C.red },
  alertMeta:    { fontSize: 12, color: C.muted, marginTop: 4 },

  muted:        { color: C.muted, fontSize: 14 },
  errorText:    { color: C.red, fontSize: 15, textAlign: 'center', marginHorizontal: 24 },
  retryBtn:     { marginTop: 16, backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  retryText:    { color: '#111', fontWeight: '700', fontSize: 15 },
});

export default BriefingScreen;
