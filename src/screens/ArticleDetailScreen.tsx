/**
 * Article Detail Screen - Full article view
 * 
 * Shows complete article with:
 * - Hero image (if enabled)
 * - Full headline
 * - Byline and publish time
 * - Article body
 * - Source attribution
 * - Share/favorite actions
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../design-system/colors';
import { TYPOGRAPHY, getFontSize } from '../design-system/typography';
import { SPACING } from '../design-system/spacing';
import { StorageService, UserPreferences } from '../services/storage';

interface Article {
  id: string;
  headline: string;
  subhead?: string;
  byline?: string;
  publishedAt: string;
  body: string;
  imageUrl?: string;
  source: string;
  url?: string;
  category: string;
}

interface ArticleDetailScreenProps {
  article: Article;
  onBack: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const ArticleDetailScreen: React.FC<ArticleDetailScreenProps> = ({
  article,
  onBack,
  onNext,
  onPrevious,
}) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load preferences and favorite status
  useEffect(() => {
    const load = async () => {
      const prefs = await StorageService.getPreferences();
      setPreferences(prefs);

      const favorites = await StorageService.getFavorites();
      setIsFavorite(favorites.includes(article.id));

      setLoading(false);
    };
    load();
  }, [article.id]);

  // Format publish time
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Toggle favorite
  const handleFavorite = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (isFavorite) {
      await StorageService.removeFavorite(article.id);
      setIsFavorite(false);
    } else {
      await StorageService.addFavorite(article.id);
      setIsFavorite(true);
    }
  };

  // Share article
  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await Share.share({
        message: article.url
          ? `${article.headline}\n\n${article.url}`
          : article.headline,
        url: article.url,
        title: article.headline,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  // Open source URL
  const handleOpenSource = async () => {
    if (article.url) {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await Linking.openURL(article.url);
    }
  };

  if (loading || !preferences) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const bodyFontSize = getFontSize(TYPOGRAPHY.body.size, preferences.fontSize);
  const showImages = preferences.showImages && article.imageUrl;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: SPACING.xl,
          paddingHorizontal: SPACING.md,
          paddingBottom: SPACING.sm,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: COLORS.background,
        }}
      >
        <TouchableOpacity onPress={onBack} style={{ padding: SPACING.xs }}>
          <Text style={{ fontSize: 24, color: COLORS.primary }}>←</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <TouchableOpacity onPress={handleFavorite} style={{ padding: SPACING.xs }}>
            <Text style={{ fontSize: 24 }}>{isFavorite ? '★' : '☆'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={{ padding: SPACING.xs }}>
            <Text style={{ fontSize: 24 }}>↗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Article content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        {showImages && (
          <Image
            source={{ uri: article.imageUrl }}
            style={{
              width: '100%',
              height: 240,
              backgroundColor: COLORS.border,
            }}
            resizeMode="cover"
          />
        )}

        {/* Content container */}
        <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }}>
          {/* Category badge */}
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: SPACING.sm,
              paddingVertical: SPACING.xs,
              backgroundColor: COLORS.accent + '20',
              borderRadius: 4,
              marginBottom: SPACING.sm,
            }}
          >
            <Text
              style={{
                fontSize: getFontSize(TYPOGRAPHY.caption.size, preferences.fontSize),
                fontWeight: '600',
                color: COLORS.accent,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {article.category}
            </Text>
          </View>

          {/* Headline */}
          <Text
            style={{
              fontSize: getFontSize(TYPOGRAPHY.h1.size, preferences.fontSize),
              fontWeight: TYPOGRAPHY.h1.weight as any,
              lineHeight: getFontSize(TYPOGRAPHY.h1.lineHeight!, preferences.fontSize),
              color: COLORS.text,
              marginBottom: SPACING.sm,
            }}
          >
            {article.headline}
          </Text>

          {/* Subhead */}
          {article.subhead && (
            <Text
              style={{
                fontSize: getFontSize(TYPOGRAPHY.body.size + 2, preferences.fontSize),
                lineHeight: getFontSize(
                  (TYPOGRAPHY.body.size + 2) * 1.5,
                  preferences.fontSize
                ),
                color: COLORS.textLight,
                marginBottom: SPACING.md,
              }}
            >
              {article.subhead}
            </Text>
          )}

          {/* Byline and time */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: SPACING.lg,
              paddingBottom: SPACING.md,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
            }}
          >
            {article.byline && (
              <>
                <Text
                  style={{
                    fontSize: getFontSize(TYPOGRAPHY.caption.size, preferences.fontSize),
                    color: COLORS.text,
                    fontWeight: '500',
                  }}
                >
                  {article.byline}
                </Text>
                <Text style={{ marginHorizontal: SPACING.xs, color: COLORS.textLight }}>
                  ·
                </Text>
              </>
            )}
            <Text
              style={{
                fontSize: getFontSize(TYPOGRAPHY.caption.size, preferences.fontSize),
                color: COLORS.textLight,
              }}
            >
              {formatTime(article.publishedAt)}
            </Text>
          </View>

          {/* Article body */}
          <Text
            style={{
              fontSize: bodyFontSize,
              lineHeight: bodyFontSize * 1.6,
              color: COLORS.text,
              marginBottom: SPACING.xl,
            }}
          >
            {article.body}
          </Text>

          {/* Source attribution */}
          <View
            style={{
              paddingTop: SPACING.md,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
            }}
          >
            <Text
              style={{
                fontSize: getFontSize(TYPOGRAPHY.caption.size, preferences.fontSize),
                color: COLORS.textLight,
                marginBottom: SPACING.xs,
              }}
            >
              Source
            </Text>
            <TouchableOpacity onPress={handleOpenSource} disabled={!article.url}>
              <Text
                style={{
                  fontSize: getFontSize(TYPOGRAPHY.body.size, preferences.fontSize),
                  color: article.url ? COLORS.primary : COLORS.text,
                  fontWeight: '500',
                }}
              >
                {article.source}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Navigation footer (if available) */}
      {(onPrevious || onNext) && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.md,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            backgroundColor: COLORS.background,
          }}
        >
          {onPrevious ? (
            <TouchableOpacity
              onPress={onPrevious}
              style={{
                paddingVertical: SPACING.sm,
                paddingHorizontal: SPACING.md,
              }}
            >
              <Text style={{ fontSize: 16, color: COLORS.primary, fontWeight: '500' }}>
                ← Previous
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {onNext ? (
            <TouchableOpacity
              onPress={onNext}
              style={{
                paddingVertical: SPACING.sm,
                paddingHorizontal: SPACING.md,
              }}
            >
              <Text style={{ fontSize: 16, color: COLORS.primary, fontWeight: '500' }}>
                Next →
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>
      )}
    </View>
  );
};
