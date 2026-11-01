import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '../theme';

export default function Button({ title, onPress, variant = 'primary', disabled, style }) {
  const c = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: 46,
          paddingHorizontal: 20,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: c.accent,
          backgroundColor: primary ? c.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: primary ? c.onAccent : c.ink, fontWeight: '600', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}
