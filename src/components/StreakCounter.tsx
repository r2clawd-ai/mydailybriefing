import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StreakCounterProps {
  streakDays: number;
  position?: 'topRight' | 'belowGreeting';
}

/**
 * "In The Know" Badge System
 * Knowledge-based progression that avoids community gatekeeping
 * 
 * Features:
 * - Expertise/knowledge theme (not exclusionary)
 * - Badge progression from "First Edition" to "Luminary"
 * - Celebrates habit formation milestones
 */
export const StreakCounter: React.FC<StreakCounterProps> = ({
  streakDays,
  position = 'topRight',
}) => {
  // Badge progression system
  const getBadgeInfo = () => {
    if (streakDays >= 365) {
      return { emoji: '🌟', badge: 'Enlightened', tagline: 'One full year. Unreal.', size: 40 };
    }
    if (streakDays >= 100) {
      return { emoji: '⭐', badge: 'Luminary', tagline: '100 days. You\'re a legend.', size: 36 };
    }
    if (streakDays >= 90) {
      return { emoji: '🏆', badge: 'Authority', tagline: 'Three months. Unstoppable.', size: 34 };
    }
    if (streakDays >= 60) {
      return { emoji: '🔑', badge: 'Insider', tagline: 'Two months of daily knowledge', size: 32 };
    }
    if (streakDays >= 30) {
      return { emoji: '💡', badge: 'Expert Reader', tagline: 'A month of staying informed', size: 30 };
    }
    if (streakDays >= 21) {
      return { emoji: '🔍', badge: 'In The Know', tagline: 'Habit formed', size: 28 };
    }
    if (streakDays >= 14) {
      return { emoji: '🎓', badge: 'Well-Informed', tagline: 'Two weeks of daily insights', size: 28 };
    }
    if (streakDays >= 7) {
      return { emoji: '📅', badge: 'Weekly Reader', tagline: 'One week strong', size: 26 };
    }
    if (streakDays >= 3) {
      return { emoji: '📖', badge: 'Getting Informed', tagline: 'Building the habit', size: 24 };
    }
    return { emoji: '📰', badge: 'First Edition', tagline: 'Everyone starts somewhere', size: 24 };
  };

  const badgeInfo = getBadgeInfo();

  const containerStyle = position === 'topRight' 
    ? styles.containerTopRight 
    : styles.containerBelowGreeting;

  return (
    <View style={containerStyle}>
      <View style={styles.streakBadge}>
        <Text style={[styles.badgeEmoji, { fontSize: badgeInfo.size }]}>{badgeInfo.emoji}</Text>
        <View style={styles.streakInfo}>
          <Text style={styles.badgeName}>{badgeInfo.badge}</Text>
          <Text style={styles.streakText}>{streakDays} {streakDays === 1 ? 'day' : 'days'}</Text>
        </View>
      </View>
      <Text style={styles.badgeTagline}>{badgeInfo.tagline}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  containerTopRight: {
    position: 'absolute',
    top: 60,
    right: 20,
    alignItems: 'center',
  },
  containerBelowGreeting: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeEmoji: {
    marginRight: 12,
  },
  streakInfo: {
    alignItems: 'flex-start',
  },
  badgeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 18,
  },
  streakText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  badgeTagline: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
});
