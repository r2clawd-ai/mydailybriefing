/**
 * NewspaperHeader Component
 * Classic newspaper masthead design inspired by NYT/Daily Mail
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

export interface NewspaperHeaderProps {
  city?: string;
  date?: string;
  weather?: string;
  volume?: string; // e.g., "Vol. 1, No. 42"
}

export const NewspaperHeader: React.FC<NewspaperHeaderProps> = ({
  city = 'Sioux Falls',
  date,
  weather,
  volume = 'Volume 1, No. 1',
}) => {
  const today = new Date();
  const formattedDate = date || today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Top line with volume and date */}
      <View style={styles.topLine}>
        <Text style={styles.topLineText}>{volume}</Text>
        <Text style={styles.topLineText}>{formattedDate}</Text>
      </View>

      {/* Decorative border */}
      <View style={styles.borderTop} />

      {/* Main masthead */}
      <View style={styles.masthead}>
        <Text style={styles.title}>THE DAILY BRIEFING</Text>
        <Text style={styles.cityName}>{city.toUpperCase()} EDITION</Text>
      </View>

      {/* Decorative border */}
      <View style={styles.borderBottom} />

      {/* Tagline and weather */}
      <View style={styles.bottomLine}>
        <Text style={styles.tagline}>"All the News Worth Knowing"</Text>
        {weather && <Text style={styles.weather}>{weather}</Text>}
      </View>

      {/* Final separator */}
      <View style={styles.finalSeparator} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },

  // Top line (volume and date)
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },

  topLineText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },

  // Decorative borders
  borderTop: {
    height: 3,
    backgroundColor: colors.textPrimary,
    marginVertical: spacing.xs,
  },

  borderBottom: {
    height: 3,
    backgroundColor: colors.textPrimary,
    marginVertical: spacing.xs,
  },

  // Main masthead
  masthead: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  title: {
    fontSize: 38, // Large, bold newspaper title
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
    textAlign: 'center',
    // Serif font would be ideal, but using system bold for now
    // In production, load a serif font like Playfair Display or Old English
    fontFamily: 'System', // Will be bold due to fontWeight
  },

  cityName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 2.5,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Bottom line (tagline and weather)
  bottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },

  tagline: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  weather: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // Final separator before content
  finalSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.md,
  },
});
