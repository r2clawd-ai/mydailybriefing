import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Image, Pressable } from 'react-native';

interface NewspaperAnimationProps {
  onComplete: () => void;
  onSkip?: () => void;
}

/**
 * Newspaper Spiral Animation
 * Classic old-movie spinning newspaper effect (Citizen Kane, Superman)
 * 
 * Animation flow:
 * 1. Start at 5x scale, rotated, invisible
 * 2. Spin 2 full rotations while zooming in
 * 3. Settle at 1x scale, 0° rotation, full opacity
 * 4. Fade to briefing content
 * 
 * Duration: 1.5 seconds total
 * Skip available after 0.5 seconds
 */
export const NewspaperAnimation: React.FC<NewspaperAnimationProps> = ({ 
  onComplete, 
  onSkip 
}) => {
  // Animation values
  const rotateValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(5)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;
  const skipOpacity = useRef(new Animated.Value(0)).current;
  
  // Track if skip is available
  const [skipAvailable, setSkipAvailable] = React.useState(false);

  useEffect(() => {
    // Make skip button appear after 500ms
    setTimeout(() => {
      setSkipAvailable(true);
      Animated.timing(skipOpacity, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 500);

    // Main animation sequence
    Animated.parallel([
      // Rotation: 0° → 720° (2 full spins)
      Animated.timing(rotateValue, {
        toValue: 720,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      
      // Scale: 5x → 1x (zoom in)
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      
      // Opacity: 0 → 1 (fade in)
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animation complete, transition to briefing
      setTimeout(onComplete, 300);
    });
  }, []);

  // Interpolate rotation (degrees to radians)
  const rotate = rotateValue.interpolate({
    inputRange: [0, 720],
    outputRange: ['0deg', '720deg'],
  });

  const handleSkip = () => {
    if (skipAvailable && onSkip) {
      onSkip();
    }
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.background} />
      
      {/* Animated Newspaper */}
      <Animated.View
        style={[
          styles.newspaper,
          {
            transform: [
              { rotate },
              { scale: scaleValue },
            ],
            opacity: opacityValue,
          },
        ]}
      >
        {/* App Logo / Masthead */}
        <View style={styles.masthead}>
          <Animated.Text style={styles.title}>
            MY DAILY BRIEFING
          </Animated.Text>
          <View style={styles.divider} />
          <Animated.Text style={styles.tagline}>
            Your Morning, Simplified
          </Animated.Text>
        </View>

        {/* Optional: Newspaper texture/pattern */}
        <View style={styles.newspaperTexture}>
          {/* Could add subtle grid lines or paper texture here */}
        </View>
      </Animated.View>

      {/* Skip Button */}
      {skipAvailable && (
        <Animated.View style={[styles.skipContainer, { opacity: skipOpacity }]}>
          <Pressable 
            style={styles.skipButton} 
            onPress={handleSkip}
          >
            <Animated.Text style={styles.skipText}>Skip</Animated.Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a', // Dark newspaper backdrop
  },
  newspaper: {
    width: 320,
    height: 420,
    backgroundColor: '#f5f1e8', // Cream newspaper color
    borderRadius: 8,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  masthead: {
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: -1,
    fontFamily: 'serif', // Classic newspaper font
  },
  divider: {
    width: '80%',
    height: 2,
    backgroundColor: '#1a1a1a',
    marginVertical: 16,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  newspaperTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    // Could add grid pattern or texture image here
  },
  skipContainer: {
    position: 'absolute',
    bottom: 60,
    right: 32,
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  skipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
