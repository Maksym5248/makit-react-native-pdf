import React from 'react';

import { Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  title: string;
  disabled?: boolean;
  onPress: () => void;
}

export function Button({ title, disabled = false, onPress }: Props) {
  const backgroundColor = disabled ? '#edf0ee' : '#e3ece6';
  const color = disabled ? '#64746a' : '#254b35';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.text, { color }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  text: { textAlign: 'center', margin: 10, fontSize: 14, fontWeight: '600' },
});
