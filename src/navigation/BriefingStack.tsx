/**
 * BriefingStack
 * Stack navigator for briefing flow (list → detail)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BriefingScreen } from '../screens/BriefingScreen';
import { ArticleDetailScreen } from '../screens/ArticleDetailScreen';

export type BriefingStackParamList = {
  BriefingList: undefined;
  ArticleDetail: {
    article: {
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
    };
    articleIndex?: number;
    totalArticles?: number;
  };
};

const Stack = createNativeStackNavigator<BriefingStackParamList>();

export const BriefingStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="BriefingList" component={BriefingScreen} />
      <Stack.Screen name="ArticleDetail" component={ArticleDetailScreenWrapper} />
    </Stack.Navigator>
  );
};

/**
 * Wrapper to convert navigation params to ArticleDetailScreen props
 */
const ArticleDetailScreenWrapper: React.FC<any> = ({ navigation, route }) => {
  const { article, articleIndex, totalArticles } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = articleIndex !== undefined && articleIndex < (totalArticles ?? 0) - 1
    ? () => {
        // TODO: Navigate to next article
        console.log('Next article:', articleIndex + 1);
      }
    : undefined;

  const handlePrevious = articleIndex !== undefined && articleIndex > 0
    ? () => {
        // TODO: Navigate to previous article
        console.log('Previous article:', articleIndex - 1);
      }
    : undefined;

  return (
    <ArticleDetailScreen
      article={article}
      onBack={handleBack}
      onNext={handleNext}
      onPrevious={handlePrevious}
    />
  );
};
