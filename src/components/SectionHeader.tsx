/**
 * SectionHeader Component
 * Divides content into sections (Markets, News, Sports, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

export interface SectionHeaderProps {
  icon?: string; // Emoji or icon
  title: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <Text style={styles.title}>{title.toUpperCase()}</Text>
      </View>
      <View style={styles.divider} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  icon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },

  title: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1.2,
  },

  divider: {
    height: 2,
    backgroundColor: colors.border,
    width: '100%',
  },
});
