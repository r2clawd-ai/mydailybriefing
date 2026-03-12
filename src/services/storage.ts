/**
 * Persistent storage service using AsyncStorage
 * Handles user preferences and app state
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_PREFERENCES: '@briefing:user_preferences',
  LAST_READ_DATE: '@briefing:last_read_date',
  FAVORITES: '@briefing:favorites',
} as const;

export interface UserPreferences {
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  showImages: boolean;
  sections: {
    news: boolean;
    weather: boolean;
    sports: boolean;
    business: boolean;
  };
  mastheadVariant: 'classic' | 'modern' | 'minimal';
}

const DEFAULT_PREFERENCES: UserPreferences = {
  fontSize: 'medium',
  showImages: true,
  sections: {
    news: true,
    weather: true,
    sports: true,
    business: true,
  },
  mastheadVariant: 'classic',
};

/**
 * Storage service for persistent user data
 */
export const StorageService = {
  /**
   * Get user preferences (with defaults)
   */
  async getPreferences(): Promise<UserPreferences> {
    try {
      const json = await AsyncStorage.getItem(KEYS.USER_PREFERENCES);
      if (json) {
        const stored = JSON.parse(json);
        // Merge with defaults to handle new fields
        return { ...DEFAULT_PREFERENCES, ...stored };
      }
      return DEFAULT_PREFERENCES;
    } catch (error) {
      console.error('Failed to load preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  },

  /**
   * Save user preferences
   */
  async savePreferences(preferences: UserPreferences): Promise<void> {
    try {
      const json = JSON.stringify(preferences);
      await AsyncStorage.setItem(KEYS.USER_PREFERENCES, json);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  },

  /**
   * Update specific preference fields
   */
  async updatePreferences(
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const updated = { ...current, ...updates };
    await this.savePreferences(updated);
    return updated;
  },

  /**
   * Get last read date (for "new" badge logic)
   */
  async getLastReadDate(): Promise<Date | null> {
    try {
      const timestamp = await AsyncStorage.getItem(KEYS.LAST_READ_DATE);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error('Failed to load last read date:', error);
      return null;
    }
  },

  /**
   * Mark briefing as read
   */
  async markAsRead(): Promise<void> {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(KEYS.LAST_READ_DATE, now);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },

  /**
   * Get favorite article IDs
   */
  async getFavorites(): Promise<string[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.FAVORITES);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('Failed to load favorites:', error);
      return [];
    }
  },

  /**
   * Add article to favorites
   */
  async addFavorite(articleId: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      if (!favorites.includes(articleId)) {
        favorites.push(articleId);
        await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
      }
    } catch (error) {
      console.error('Failed to add favorite:', error);
    }
  },

  /**
   * Remove article from favorites
   */
  async removeFavorite(articleId: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const filtered = favorites.filter((id) => id !== articleId);
      await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  },

  /**
   * Clear all stored data (reset app)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.USER_PREFERENCES,
        KEYS.LAST_READ_DATE,
        KEYS.FAVORITES,
      ]);
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  },
};
