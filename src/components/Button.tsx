/**
 * Button Component
 * With press animation and haptic feedback
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, animations } from '../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    if (!disabled && !loading) {
      setPressed(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    setPressed(false);
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      onPress();
    }
  };

  const getContainerStyle = (): ViewStyle => {
    const baseStyle = [styles.container];

    if (variant === 'primary') {
      baseStyle.push(styles.primaryContainer);
    } else if (variant === 'secondary') {
      baseStyle.push(styles.secondaryContainer);
    } else {
      baseStyle.push(styles.textContainer);
    }

    if (disabled) {
      baseStyle.push(styles.disabled);
    }

    if (pressed) {
      baseStyle.push(styles.pressed);
    }

    if (style) {
      baseStyle.push(style);
    }

    return StyleSheet.flatten(baseStyle);
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = [styles.text];

    if (variant === 'primary') {
      baseStyle.push(styles.primaryText);
    } else if (variant === 'secondary') {
      baseStyle.push(styles.secondaryText);
    } else {
      baseStyle.push(styles.textButtonText);
    }

    if (textStyle) {
      baseStyle.push(textStyle);
    }

    return StyleSheet.flatten(baseStyle);
  };

  return (
    <TouchableOpacity
      style={getContainerStyle()}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.background : colors.primary}
        />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // Touch target
  },

  primaryContainer: {
    backgroundColor: colors.primary,
  },

  secondaryContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },

  textContainer: {
    backgroundColor: 'transparent',
  },

  disabled: {
    opacity: 0.5,
  },

  pressed: {
    transform: [{ scale: animations.scale.press }],
  },

  text: {
    ...typography.button,
  },

  primaryText: {
    color: colors.background,
  },

  secondaryText: {
    color: colors.textPrimary,
  },

  textButtonText: {
    color: colors.primary,
  },
});
