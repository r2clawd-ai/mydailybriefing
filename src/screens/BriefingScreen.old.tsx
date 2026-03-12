/**
 * BriefingScreen
 * Main screen displaying the daily briefing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { ArticleCard, SectionHeader, Button, NewspaperHeader } from '../components';
import { colors, typography, spacing } from '../theme';
import { mockBriefingData } from '../utils/mockData';
import { getPreferences, UserPreferences } from '../utils/preferences';
import { useHaptics } from '../hooks/useHaptics';

export const BriefingScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(getPreferences());
  const haptics = useHaptics();

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Success haptic
    await haptics.notification();
    
    setRefreshing(false);
  };

  const handleArticlePress = (articleId: string) => {
    console.log('Article pressed:', articleId);
    haptics.impact();
  };

  const renderHeader = () => (
    <NewspaperHeader
      city={prefs.city}
      weather={prefs.showWeatherInHeader ? "High 28°F, Low 18°F • Mostly Cloudy" : undefined}
      volume={prefs.showVolume ? "Vol. 1, No. 42" : undefined}
    />
  );

  // Filter sections based on user preferences
  const filteredData = mockBriefingData.filter(section => {
    switch (section.section) {
      case 'markets':
        return prefs.sections.markets;
      case 'local':
        return prefs.sections.localNews;
      case 'sports':
        return prefs.sections.sports;
      case 'weather':
        return prefs.sections.weather;
      default:
        return true;
    }
  });

  const renderCompletion = () => (
    <View style={styles.completion}>
      <Text style={styles.completionEmoji}>✅</Text>
      <Text style={styles.completionTitle}>You've reached the end!</Text>
      <Text style={styles.completionSubtitle}>
        Time to read: ~8 minutes
        {'\n'}
        Stories: 32 items across 16 sections
      </Text>
      <Text style={styles.completionNext}>
        Next briefing: Tomorrow 6:45 AM
      </Text>
      <Button
        title="Archive Today's Briefing"
        onPress={() => {
          console.log('Archive briefing');
          haptics.notification();
        }}
        variant="secondary"
        style={styles.archiveButton}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        {renderHeader()}

        {/* Content Sections */}
        {filteredData.map((section, sectionIndex) => (
          <View key={section.section}>
            {/* Section Header */}
            <SectionHeader icon={section.icon} title={section.title} />

            {/* Articles in Section */}
            {section.articles.map((article, articleIndex) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                summary={article.summary}
                imageUrl={prefs.showImages ? article.imageUrl : undefined}
                source={article.source}
                timeAgo={article.timeAgo}
                onPress={() => handleArticlePress(article.id)}
              />
            ))}
          </View>
        ))}

        {/* Completion State */}
        {renderCompletion()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: spacing.xxxl,
  },

  completion: {
    paddingHorizontal: 20,
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },

  completionEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  completionTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  completionSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  completionNext: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xl,
  },

  archiveButton: {
    minWidth: 250,
  },
});
