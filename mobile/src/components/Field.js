import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { useStyles, useTheme } from '../theme';

export default function Field({ label, error, style, ...input }) {
  const s = useStyles();
  const c = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[s.input, error ? { borderColor: c.danger } : null, style]}
        {...input}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={s.err}>{error}</Text> : null}
    </View>
  );
}
