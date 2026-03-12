import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PersonalizedGreetingProps {
  userName?: string;
  showDate?: boolean;
}

/**
 * Personalized Greeting Component
 * Time-of-day responsive greeting with user's name
 * 
 * Greeting logic:
 * - 5 AM - 11:59 AM: "Good morning"
 * - 12 PM - 4:59 PM: "Good afternoon"
 * - 5 PM - 8:59 PM: "Good evening"
 * - 9 PM - 4:59 AM: "Welcome back"
 */
export const PersonalizedGreeting: React.FC<PersonalizedGreetingProps> = ({
  userName = 'there',
  showDate = true,
}) => {
  const now = new Date();
  const hour = now.getHours();

  // Determine greeting based on time
  let greeting = 'Welcome back';
  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good evening';
  }

  // Format date
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {greeting}, {userName}
      </Text>
      {showDate && (
        <Text style={styles.date}>{dateStr}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
});
