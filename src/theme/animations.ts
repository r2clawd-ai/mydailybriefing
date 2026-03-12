/**
 * Animation config for My Daily Briefing
 * Smooth, 60 FPS, physics-based animations
 */

export const animations = {
  // Durations (milliseconds)
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
  },
  
  // Spring configs (for physics-based animations)
  spring: {
    gentle: {
      damping: 15,
      stiffness: 150,
    },
    bouncy: {
      damping: 10,
      stiffness: 100,
    },
    snappy: {
      damping: 20,
      stiffness: 300,
    },
  },
  
  // Easing curves (for timing-based animations)
  easing: {
    easeOut: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
    easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
  },
  
  // Common scale values
  scale: {
    press: 0.97,    // Button press
    small: 0.95,    // Subtle shrink
    large: 1.05,    // Subtle grow
  },
} as const;

export type AnimationKey = keyof typeof animations;
