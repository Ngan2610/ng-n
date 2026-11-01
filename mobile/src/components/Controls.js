import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

/** Nút chọn dạng viên thuốc (bật/tắt hoặc chọn một). */
export function Chip({ label, selected, onPress }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: selected ? c.accent : c.line,
        backgroundColor: selected ? c.accent : c.panel,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: selected ? c.onAccent : c.ink, fontWeight: '500', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Thanh chuyển tab nhỏ: options = [{ key, label }]. */
export function Segmented({ options, value, onChange }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden', backgroundColor: c.panel }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: on ? c.accent : 'transparent' }}
          >
            <Text style={{ color: on ? c.onAccent : c.muted, fontWeight: '600', fontSize: 13.5, textAlign: 'center' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
