/**
 * Theme system for My Daily Briefing
 * Central export for all design tokens
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './animations';

import { colors } from './colors';
import { typography } from './typography';
import { spacing, spacingPatterns } from './spacing';
import { animations } from './animations';

export const theme = {
  colors,
  typography,
  spacing,
  spacingPatterns,
  animations,
} as const;

export type Theme = typeof theme;
