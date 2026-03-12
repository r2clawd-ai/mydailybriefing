/**
 * My Daily Briefing — Root component
 * Handles auth state and routes between Onboarding and Briefing.
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { BriefingScreen }   from './src/screens/BriefingScreen';

export default function App() {
  const [state, setState] = useState<'loading' | 'onboarding' | 'briefing'>('loading');

  useEffect(() => {
    AsyncStorage.getItem('@briefing:token').then(token => {
      setState(token ? 'briefing' : 'onboarding');
    });
  }, []);

  const handleOnboardingComplete = (_token: string) => setState('briefing');

  const handleSignOut = () => {
    AsyncStorage.removeItem('@briefing:token');
    setState('onboarding');
  };

  if (state === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#f0c040" size="large" />
      </View>
    );
  }

  return state === 'onboarding'
    ? <OnboardingScreen onComplete={handleOnboardingComplete} />
    : <BriefingScreen onSignOut={handleSignOut} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
