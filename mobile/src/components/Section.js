import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';

/** Một khối nội dung như `.section` trên web; `alt` = nền trắng có viền trên/dưới (giống `.section.alt`). */
export default function Section({ alt, children, style, onLayout }) {
  const c = useTheme();
  return (
    <View
      onLayout={onLayout}
      style={[
        { paddingHorizontal: 20, paddingVertical: 48 },
        alt ? { backgroundColor: c.panel, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
