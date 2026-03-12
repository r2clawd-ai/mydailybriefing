/**
 * Typography system for My Daily Briefing
 * Based on magazine-quality editorial design
 */

import { TextStyle } from 'react-native';

export const typography = {
  // Display (Hero headlines)
  display: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
  } as TextStyle,
  
  // Title (Section headers)
  title: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    letterSpacing: -0.3,
  } as TextStyle,
  
  // Headline (Article titles)
  headline: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.2,
  } as TextStyle,
  
  // Body (Reading text)
  body: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 27,  // 1.6× for readability
    letterSpacing: 0,
  } as TextStyle,
  
  // Body Small
  bodySmall: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: 0,
  } as TextStyle,
  
  // Caption (Metadata)
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0,
  } as TextStyle,
  
  // Caption Small
  captionSmall: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
    letterSpacing: 0.2,
  } as TextStyle,
  
  // Button
  button: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.1,
  } as TextStyle,
} as const;

export type TypographyKey = keyof typeof typography;
