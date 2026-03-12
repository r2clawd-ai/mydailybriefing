/**
 * SettingsScreen
 * User preferences and customization
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { colors, typography, spacing } from '../theme';
import { getPreferences, updatePreferences, UserPreferences } from '../utils/preferences';
import { useHaptics } from '../hooks/useHaptics';

export const SettingsScreen: React.FC = () => {
  const [prefs, setPrefs] = useState<UserPreferences>(getPreferences());
  const haptics = useHaptics();

  const handleToggle = (key: keyof UserPreferences['sections'], value: boolean) => {
    haptics.selection();
    const updated = updatePreferences({
      sections: {
        ...prefs.sections,
        [key]: value,
      },
    });
    setPrefs(updated);
  };

  const handleHeaderStyleChange = (style: UserPreferences['headerStyle']) => {
    haptics.impact();
    const updated = updatePreferences({ headerStyle: style });
    setPrefs(updated);
  };

  const handleFontSizeChange = (size: UserPreferences['fontSize']) => {
    haptics.impact();
    const updated = updatePreferences({ fontSize: size });
    setPrefs(updated);
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderToggle = (label: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        ios_backgroundColor={colors.border}
      />
    </View>
  );

  const renderChoice = (
    label: string,
    options: { value: string; label: string }[],
    selected: string,
    onChange: (value: string) => void
  ) => (
    <View style={styles.choiceContainer}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.choiceButtons}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.choiceButton,
              selected === option.value && styles.choiceButtonActive,
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text
              style={[
                styles.choiceButtonText,
                selected === option.value && styles.choiceButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚙️ Settings</Text>
          <Text style={styles.headerSubtitle}>Customize your briefing</Text>
        </View>

        {/* Content Sections */}
        {renderSection('Content', (
          <>
            {renderToggle('Markets', prefs.sections.markets, (val) => handleToggle('markets', val))}
            {renderToggle('Local News', prefs.sections.localNews, (val) => handleToggle('localNews', val))}
            {renderToggle('Sports', prefs.sections.sports, (val) => handleToggle('sports', val))}
            {renderToggle('Weather', prefs.sections.weather, (val) => handleToggle('weather', val))}
            {renderToggle('Calendar', prefs.sections.calendar, (val) => handleToggle('calendar', val))}
            {renderToggle('Twitter/X', prefs.sections.twitter, (val) => handleToggle('twitter', val))}
          </>
        ))}

        {/* Display */}
        {renderSection('Display', (
          <>
            {renderChoice(
              'Header Style',
              [
                { value: 'newspaper', label: 'Newspaper' },
                { value: 'modern', label: 'Modern' },
                { value: 'minimal', label: 'Minimal' },
              ],
              prefs.headerStyle,
              (val) => handleHeaderStyleChange(val as UserPreferences['headerStyle'])
            )}
            
            {renderChoice(
              'Font Size',
              [
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
                { value: 'xlarge', label: 'X-Large' },
              ],
              prefs.fontSize,
              (val) => handleFontSizeChange(val as UserPreferences['fontSize'])
            )}

            {renderToggle('Show Images', prefs.showImages, (val) => {
              haptics.selection();
              const updated = updatePreferences({ showImages: val });
              setPrefs(updated);
            })}
          </>
        ))}

        {/* Masthead */}
        {renderSection('Masthead', (
          <>
            {renderToggle('Show Volume Number', prefs.showVolume, (val) => {
              haptics.selection();
              const updated = updatePreferences({ showVolume: val });
              setPrefs(updated);
            })}
            
            {renderToggle('Show Weather in Header', prefs.showWeatherInHeader, (val) => {
              haptics.selection();
              const updated = updatePreferences({ showWeatherInHeader: val });
              setPrefs(updated);
            })}
          </>
        ))}

        {/* Notifications */}
        {renderSection('Notifications', (
          <>
            {renderToggle('Enable Notifications', prefs.enableNotifications, (val) => {
              haptics.selection();
              const updated = updatePreferences({ enableNotifications: val });
              setPrefs(updated);
            })}
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Briefing Time</Text>
              <Text style={styles.settingValue}>{prefs.briefingTime} AM</Text>
            </View>
          </>
        ))}

        {/* Location */}
        {renderSection('Location', (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>City</Text>
            <Text style={styles.settingValue}>{prefs.city}</Text>
          </View>
        ))}
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

  header: {
    paddingHorizontal: 20,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },

  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  section: {
    paddingHorizontal: 20,
    paddingTop: spacing.xl,
  },

  sectionTitle: {
    ...typography.headline,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  settingLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },

  settingValue: {
    ...typography.body,
    color: colors.textSecondary,
  },

  choiceContainer: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  choiceButtons: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },

  choiceButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },

  choiceButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  choiceButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },

  choiceButtonTextActive: {
    color: colors.background,
  },
});
