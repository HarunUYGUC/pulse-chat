import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface TypingBarProps {
  typingUsers: string[];
}

export const TypingBar: React.FC<TypingBarProps> = ({ typingUsers }) => {
  if (typingUsers.length === 0) {
    return <View style={styles.placeholder} />;
  }

  let text = '';
  if (typingUsers.length === 1) {
    text = `${typingUsers[0]} is typing...`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
  } else {
    text = 'Several people are typing...';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 22,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
  },
  placeholder: {
    height: 6,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
