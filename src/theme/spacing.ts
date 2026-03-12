/**
 * Spacing system for My Daily Briefing
 * Based on 8-point grid system
 */

export const spacing = {
  xs: 4,   // 0.5× base
  sm: 8,   // 1× base
  md: 16,  // 2× base
  lg: 24,  // 3× base
  xl: 32,  // 4× base
  xxl: 48, // 6× base
  xxxl: 64, // 8× base
} as const;

export type SpacingKey = keyof typeof spacing;

// Common spacing patterns
export const spacingPatterns = {
  // Card padding
  cardPadding: spacing.md,
  
  // Screen margins
  screenHorizontal: 20, // Not 16 - gives breathing room from edge
  screenVertical: spacing.lg,
  
  // Section spacing
  sectionGap: spacing.xl,
  
  // Element spacing
  elementGap: spacing.sm,
  
  // Touch target minimum
  touchTarget: 48,
} as const;
