import React from 'react';

import { Platform, Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  title: string;
  disabled?: boolean;
  onPress: () => void;
}

// Keep enabled/disabled colors explicit: removing RN Button's disabled style
// can leave its Android text/view with the previous native color.
export function Button({ title, disabled = false, onPress }: Props) {
  const android = Platform.OS === 'android';
  let backgroundColor = 'transparent';
  let color = '#007aff';
  if (android) {
    backgroundColor = disabled ? '#dfdfdf' : '#2196f3';
    color = '#ffffff';
  }
  if (disabled) color = '#767676';
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
        {android ? title.toUpperCase() : title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 2, minHeight: 44, justifyContent: 'center' },
  text: { textAlign: 'center', margin: 8, fontSize: 14, fontWeight: '500' },
});
