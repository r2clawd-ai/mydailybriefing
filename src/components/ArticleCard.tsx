/**
 * ArticleCard Component
 * The main content card displaying briefing items
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { colors, typography, spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 200;

export interface ArticleCardProps {
  title: string;
  summary?: string;
  imageUrl?: string;
  source?: string;
  timeAgo?: string;
  author?: string;
  isFavorite?: boolean;
  onPress?: () => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  title,
  summary,
  imageUrl,
  source,
  timeAgo,
  author,
  isFavorite,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Hero Image (if provided) */}
      {imageUrl && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Headline */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>
          {isFavorite && (
            <Text style={styles.favoriteIcon}>★</Text>
          )}
        </View>

        {/* Summary (if provided) */}
        {summary && (
          <Text style={styles.summary} numberOfLines={2}>
            {summary}
          </Text>
        )}

        {/* Metadata */}
        {(source || timeAgo || author) && (
          <View style={styles.metadata}>
            <Text style={styles.metadataText}>
              {[source, timeAgo, author].filter(Boolean).join(' • ')}
            </Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.background,
  },

  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: colors.backgroundSecondary,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  content: {
    paddingHorizontal: 20, // Screen margin
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },

  title: {
    ...typography.headline,
    color: colors.textPrimary,
    flex: 1,
  },

  favoriteIcon: {
    fontSize: 18,
    color: colors.accent,
    marginLeft: spacing.xs,
  },

  summary: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metadataText: {
    ...typography.caption,
    color: colors.textTertiary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    marginTop: spacing.md,
  },
});
