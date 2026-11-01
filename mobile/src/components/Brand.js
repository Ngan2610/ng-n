import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

/** Logo 3 vạch màu + chữ Dubchef (giống `.brand` trên web). */
export default function Brand({ size = 21 }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ gap: 3, width: 24 }}>
        <View style={{ height: 5, borderRadius: 3, width: '100%', backgroundColor: c.vi }} />
        <View style={{ height: 5, borderRadius: 3, width: '72%', backgroundColor: c.en }} />
        <View style={{ height: 5, borderRadius: 3, width: '88%', backgroundColor: c.zh }} />
      </View>
      <Text accessibilityRole="header" style={{ fontSize: size, fontWeight: '800', color: c.ink, letterSpacing: -0.4 }}>Dubchef</Text>
    </View>
  );
}
