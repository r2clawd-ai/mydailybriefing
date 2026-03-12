/**
 * User Preferences System
 * Handles all customizable settings
 */

export interface UserPreferences {
  // Display
  theme: 'light' | 'dark';
  headerStyle: 'newspaper' | 'modern' | 'minimal';
  
  // Content
  city: string;
  sections: {
    markets: boolean;
    localNews: boolean;
    sports: boolean;
    weather: boolean;
    calendar: boolean;
    twitter: boolean;
  };
  
  // Notifications
  briefingTime: string; // "06:45"
  enableNotifications: boolean;
  
  // Reading
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  showImages: boolean;
  
  // Masthead customization
  showVolume: boolean;
  showWeatherInHeader: boolean;
  customTagline?: string;
}

export const defaultPreferences: UserPreferences = {
  theme: 'light',
  headerStyle: 'newspaper',
  city: 'Sioux Falls',
  sections: {
    markets: true,
    localNews: true,
    sports: true,
    weather: true,
    calendar: false, // Requires setup
    twitter: false,   // Requires setup
  },
  briefingTime: '06:45',
  enableNotifications: true,
  fontSize: 'medium',
  showImages: true,
  showVolume: true,
  showWeatherInHeader: true,
};

// In production, this would use AsyncStorage
let currentPreferences: UserPreferences = { ...defaultPreferences };

export const getPreferences = (): UserPreferences => {
  return { ...currentPreferences };
};

export const updatePreferences = (updates: Partial<UserPreferences>): UserPreferences => {
  currentPreferences = {
    ...currentPreferences,
    ...updates,
  };
  
  // In production: Save to AsyncStorage
  // await AsyncStorage.setItem('userPreferences', JSON.stringify(currentPreferences));
  
  return { ...currentPreferences };
};

export const resetPreferences = (): UserPreferences => {
  currentPreferences = { ...defaultPreferences };
  return { ...currentPreferences };
};

// Font size multipliers
export const getFontSizeMultiplier = (size: UserPreferences['fontSize']): number => {
  switch (size) {
    case 'small': return 0.875;  // 87.5%
    case 'medium': return 1.0;   // 100%
    case 'large': return 1.125;  // 112.5%
    case 'xlarge': return 1.25;  // 125%
  }
};
