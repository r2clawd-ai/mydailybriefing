/**
 * Loading Skeleton Components
 * 
 * Animated placeholder UI while content loads
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../design-system/colors';
import { SPACING } from '../design-system/spacing';

/**
 * Animated skeleton box
 */
export const SkeletonBox: React.FC<{
  width: number | string;
  height: number;
  style?: any;
}> = ({ width, height, style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: COLORS.border,
          borderRadius: 4,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton for article card
 */
export const ArticleCardSkeleton: React.FC = () => {
  return (
    <View style={styles.articleCard}>
      {/* Image placeholder */}
      <SkeletonBox width={80} height={80} style={{ borderRadius: 8 }} />

      {/* Content */}
      <View style={styles.articleContent}>
        {/* Category */}
        <SkeletonBox width={60} height={12} style={{ marginBottom: SPACING.xs }} />

        {/* Headline (2 lines) */}
        <SkeletonBox
          width="100%"
          height={16}
          style={{ marginBottom: SPACING.xs }}
        />
        <SkeletonBox width="70%" height={16} style={{ marginBottom: SPACING.sm }} />

        {/* Meta */}
        <SkeletonBox width={120} height={12} />
      </View>
    </View>
  );
};

/**
 * Skeleton for section header
 */
export const SectionHeaderSkeleton: React.FC = () => {
  return (
    <View style={styles.sectionHeader}>
      <SkeletonBox width={150} height={24} />
      <SkeletonBox width={40} height={16} />
    </View>
  );
};

/**
 * Skeleton for entire briefing screen
 */
export const BriefingScreenSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Masthead */}
      <View style={styles.masthead}>
        <SkeletonBox width={200} height={32} style={{ alignSelf: 'center' }} />
        <SkeletonBox
          width={150}
          height={14}
          style={{ alignSelf: 'center', marginTop: SPACING.xs }}
        />
      </View>

      {/* Section 1 */}
      <SectionHeaderSkeleton />
      <ArticleCardSkeleton />
      <ArticleCardSkeleton />

      {/* Section 2 */}
      <SectionHeaderSkeleton />
      <ArticleCardSkeleton />
    </View>
  );
};

/**
 * Skeleton for settings screen
 */
export const SettingsScreenSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Title */}
      <SkeletonBox
        width={100}
        height={28}
        style={{ marginBottom: SPACING.lg, marginTop: SPACING.lg }}
      />

      {/* Setting rows */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <SkeletonBox width="60%" height={16} style={{ marginBottom: SPACING.xs }} />
            <SkeletonBox width="40%" height={12} />
          </View>
          <SkeletonBox width={50} height={24} style={{ borderRadius: 12 }} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
  },
  masthead: {
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  articleCard: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  articleContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
});
