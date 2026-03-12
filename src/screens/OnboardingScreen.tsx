/**
 * OnboardingScreen — multi-step setup flow
 *
 * Steps:
 *  1. Welcome
 *  2. Email
 *  3. Location (zip)
 *  4. Interests (chips)
 *  5. Sports teams
 *  6. Extras (handles + stocks)
 *  7. Done → navigates to BriefingScreen
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const API_BASE = 'http://localhost:3001';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg:      '#0d0d0d',
  surface: '#161616',
  surface2:'#1e1e1e',
  border:  '#2a2a2a',
  accent:  '#f0c040',
  accent2: '#e07020',
  text:    '#f0f0f0',
  muted:   '#888888',
  error:   '#e05050',
  green:   '#4db86a',
};

const INTERESTS = [
  { label: '💰 Finance',       value: 'Finance' },
  { label: '₿ Crypto',         value: 'Crypto' },
  { label: '⚙️ Tech',          value: 'Tech' },
  { label: '🏛️ Politics',      value: 'Politics' },
  { label: '🏆 Sports',        value: 'Sports' },
  { label: '🎬 Entertainment', value: 'Entertainment' },
  { label: '🔬 Science',       value: 'Science' },
  { label: '🏃 Health',        value: 'Health' },
  { label: '📈 Business',      value: 'Business' },
  { label: '🧠 Philosophy',    value: 'Philosophy' },
  { label: '🤖 AI',            value: 'AI' },
  { label: '🏠 Real Estate',   value: 'Real Estate' },
];

interface OnboardingScreenProps {
  onComplete: (token: string) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step,     setStep]     = useState(1);
  const [email,    setEmail]    = useState('');
  const [zip,      setZip]      = useState('');
  const [cityLabel,setCityLabel]= useState('');
  const [interests,setInterests]= useState<string[]>([]);
  const [teams,    setTeams]    = useState('');
  const [handles,  setHandles]  = useState('');
  const [stocks,   setStocks]   = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const TOTAL_STEPS = 7;

  const haptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const animateNext = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -30, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue:  30, duration:   0, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue:   0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
    setError('');
  };

  // ── Zip validation ──
  const validateZip = async (value: string) => {
    if (value.length !== 5 || !/^\d{5}$/.test(value)) {
      setCityLabel('');
      return;
    }
    try {
      const res  = await fetch(`${API_BASE}/api/geo/zip/${value}`);
      if (res.ok) {
        const data = await res.json();
        setCityLabel(`${data.city}, ${data.state}`);
      }
    } catch {}
  };

  // ── Submit handlers ──
  const submitEmail = () => {
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    haptic();
    animateNext(3);
  };

  const submitZip = () => {
    if (!cityLabel && zip.length === 5) {
      setError('Could not verify that ZIP. Try another.');
      return;
    }
    haptic();
    animateNext(4);
  };

  const toggleInterest = (value: string) => {
    haptic();
    setInterests(prev =>
      prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]
    );
  };

  const submitInterests = () => { haptic(); animateNext(5); };
  const submitTeams     = () => { haptic(); animateNext(6); };

  const submitAndFinish = async () => {
    haptic();
    setLoading(true);
    setError('');

    const parsedTeams   = teams.split(',').map(s => s.trim()).filter(Boolean);
    const parsedHandles = handles.split(',').map(s => s.trim()).filter(Boolean);
    const parsedStocks  = stocks.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    try {
      const res = await fetch(`${API_BASE}/api/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          zip_code:        zip || '10001',
          interests,
          sports_teams:    parsedTeams,
          twitter_handles: parsedHandles,
          stocks:          parsedStocks,
        }),
      });

      const data = await res.json();
      const token = data.token;
      if (!token) throw new Error(data.error || 'Signup failed');

      await AsyncStorage.setItem('@briefing:token', token);
      animateNext(7);

      // Short delay then navigate
      setTimeout(() => onComplete(token), 1200);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Progress dots ──
  const ProgressDots = () => (
    <View style={styles.progressRow}>
      {Array.from({ length: TOTAL_STEPS - 1 }, (_, i) => i + 2).map(n => (
        <View
          key={n}
          style={[
            styles.progressDot,
            n < step  ? styles.progressDone :
            n === step ? styles.progressActive :
                        styles.progressInactive,
          ]}
        />
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {

      case 1: return (
        <View>
          <Text style={styles.eyebrow}>Your Daily Briefing</Text>
          <Text style={styles.h1}>Good morning{'\n'}starts here.</Text>
          <Text style={styles.subtitle}>A personal briefing built around your location, interests, and sources you actually care about.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => { haptic(); animateNext(2); }}>
            <Text style={styles.btnText}>Get started →</Text>
          </TouchableOpacity>
        </View>
      );

      case 2: return (
        <View>
          <ProgressDots />
          <Text style={styles.eyebrow}>Step 1 of 6</Text>
          <Text style={styles.h1}>What's your email?</Text>
          <Text style={styles.subtitle}>We'll save your briefing preferences.</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
            placeholderTextColor={COLORS.muted}
            onSubmitEditing={submitEmail}
            returnKeyType="next"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.btn} onPress={submitEmail}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      );

      case 3: return (
        <View>
          <ProgressDots />
          <Text style={styles.eyebrow}>Step 2 of 6</Text>
          <Text style={styles.h1}>Where are you?</Text>
          <Text style={styles.subtitle}>We'll pull local news, weather, and accounts for your area.</Text>
          <TextInput
            style={styles.input}
            value={zip}
            onChangeText={v => {
              setZip(v);
              if (v.length === 5) validateZip(v);
              else setCityLabel('');
            }}
            keyboardType="number-pad"
            placeholder="ZIP code (e.g. 57103)"
            placeholderTextColor={COLORS.muted}
            maxLength={5}
          />
          {cityLabel ? (
            <Text style={[styles.confirm]}>✓ {cityLabel}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.btn} onPress={submitZip}>
            <Text style={styles.btnText}>Confirm location →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={() => animateNext(4)}>
            <Text style={styles.btnGhostText}>Skip</Text>
          </TouchableOpacity>
        </View>
      );

      case 4: return (
        <View>
          <ProgressDots />
          <Text style={styles.eyebrow}>Step 3 of 6</Text>
          <Text style={styles.h1}>What do you follow?</Text>
          <Text style={styles.subtitle}>Pick topics. We'll pull the best content for each.</Text>
          <View style={styles.chipsWrap}>
            {INTERESTS.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, interests.includes(value) && styles.chipSelected]}
                onPress={() => toggleInterest(value)}
              >
                <Text style={[styles.chipText, interests.includes(value) && styles.chipTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.btn} onPress={submitInterests}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={() => animateNext(5)}>
            <Text style={styles.btnGhostText}>Skip</Text>
          </TouchableOpacity>
        </View>
      );

      case 5: return (
        <View>
          <ProgressDots />
          <Text style={styles.eyebrow}>Step 4 of 6</Text>
          <Text style={styles.h1}>Your teams?</Text>
          <Text style={styles.subtitle}>We'll pull scores and news for each one.</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={teams}
            onChangeText={setTeams}
            placeholder="e.g. Minnesota Vikings, Cubs, Spurs"
            placeholderTextColor={COLORS.muted}
            multiline
          />
          <TouchableOpacity style={styles.btn} onPress={submitTeams}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={() => animateNext(6)}>
            <Text style={styles.btnGhostText}>Skip</Text>
          </TouchableOpacity>
        </View>
      );

      case 6: return (
        <View>
          <ProgressDots />
          <Text style={styles.eyebrow}>Step 5 of 6</Text>
          <Text style={styles.h1}>Anything else?</Text>
          <Text style={styles.subtitle}>Twitter/X accounts to track, or stocks to watch.</Text>
          <TextInput
            style={styles.input}
            value={handles}
            onChangeText={setHandles}
            placeholder="@handles, comma separated"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
          />
          <View style={{ height: 12 }} />
          <TextInput
            style={styles.input}
            value={stocks}
            onChangeText={setStocks}
            placeholder="Tickers: AAPL, TSLA, BTC-USD"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="characters"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 28 }} />
          ) : (
            <>
              <TouchableOpacity style={styles.btn} onPress={submitAndFinish}>
                <Text style={styles.btnText}>Build my briefing →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={submitAndFinish}>
                <Text style={styles.btnGhostText}>Skip and finish</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      );

      case 7: return (
        <View style={styles.doneWrap}>
          <Text style={styles.doneEmoji}>☀️</Text>
          <Text style={styles.h1}>You're all set.</Text>
          <Text style={styles.subtitle}>Your briefing is ready. Loading it now…</Text>
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />
        </View>
      );

      default: return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.card, { transform: [{ translateX: slideAnim }] }]}>
          {renderStep()}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  shell:   { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card:    { backgroundColor: COLORS.surface, borderRadius: 16, padding: 28, borderWidth: 1, borderColor: COLORS.border },

  progressRow:    { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot:    { flex: 1, height: 3, borderRadius: 2 },
  progressDone:   { backgroundColor: COLORS.accent },
  progressActive: { backgroundColor: COLORS.accent2 },
  progressInactive:{ backgroundColor: COLORS.border },

  eyebrow:  { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 8 },
  h1:       { fontSize: 26, fontWeight: '700', color: COLORS.text, lineHeight: 32, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginBottom: 24, lineHeight: 22 },

  input: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  confirm:   { color: COLORS.accent, fontSize: 14, marginTop: 8 },
  error:     { color: COLORS.error,  fontSize: 13, marginTop: 8 },

  chipsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  chip:         { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1.5, borderColor: COLORS.border },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:         { color: COLORS.text,  fontSize: 14 },
  chipTextSelected: { color: '#111',        fontSize: 14, fontWeight: '600' },

  btn:      { backgroundColor: COLORS.accent, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  btnText:  { color: '#111', fontSize: 16, fontWeight: '700' },
  btnGhost: { borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 14, alignItems: 'center', marginTop: 10 },
  btnGhostText: { color: COLORS.muted, fontSize: 15 },

  doneWrap: { alignItems: 'center', paddingVertical: 20 },
  doneEmoji:{ fontSize: 48, marginBottom: 16 },
});

export default OnboardingScreen;
