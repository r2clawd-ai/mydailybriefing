/**
 * useHaptics Hook
 * Safe haptic feedback that gracefully handles unsupported platforms
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const useHaptics = () => {
  const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

  const impact = async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (!isSupported) return;
    
    try {
      await Haptics.impactAsync(style);
    } catch (error) {
      // Silently fail - haptics are nice to have, not critical
      console.warn('Haptic feedback not available:', error);
    }
  };

  const notification = async (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
    if (!isSupported) return;
    
    try {
      await Haptics.notificationAsync(type);
    } catch (error) {
      console.warn('Haptic notification not available:', error);
    }
  };

  const selection = async () => {
    if (!isSupported) return;
    
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Haptic selection not available:', error);
    }
  };

  return {
    impact,
    notification,
    selection,
    isSupported,
  };
};
