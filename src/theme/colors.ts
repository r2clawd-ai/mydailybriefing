/**
 * Color system for My Daily Briefing
 * Based on minimalist design principles
 */

export const colors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F8F8F8',
  
  // Text
  textPrimary: '#1A1A1A',      // 90% black (softer than pure black)
  textSecondary: '#666666',    // 60% opacity
  textTertiary: '#999999',     // 40% opacity
  
  // Brand
  primary: '#0066CC',          // Trust blue
  primaryHover: '#0052A3',     // Darker for press state
  
  // Semantic
  success: '#00A67E',          // Green
  warning: '#FF9500',          // Orange
  error: '#FF3B30',            // Red
  info: '#5AC8FA',             // Light blue
  
  // Borders
  border: '#E5E5E5',           // Subtle
  borderStrong: '#CCCCCC',     // Visible
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
} as const;

export type ColorKey = keyof typeof colors;
