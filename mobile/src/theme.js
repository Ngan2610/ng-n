import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

const light = {
  dark: false, bg: '#F4F7F5', panel: '#FFFFFF', ink: '#12302A', muted: '#4F6660', line: '#D3DDD8',
  accent: '#12302A', onAccent: '#FFFFFF', vi: '#C2331F', en: '#1F4FC4', zh: '#8A5F00',
  scBg: '#DCE9E2', scTab: '#C3D6CC', danger: '#C2331F', good: '#16794A',
};
const dark = {
  dark: true, bg: '#0F1A17', panel: '#16241F', ink: '#E8F0EC', muted: '#9DB2AA', line: '#2A3C36',
  accent: '#CDEBDD', onAccent: '#0F1A17', vi: '#FF8A78', en: '#8FB0FF', zh: '#E8B94A',
  scBg: '#1E3129', scTab: '#284238', danger: '#FF8A78', good: '#6FD3A0',
};

/** Màu theo chế độ sáng/tối của điện thoại. */
export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useStyles() {
  const c = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        h1: { fontSize: 34, fontWeight: '800', color: c.ink, lineHeight: 40, letterSpacing: -0.5 },
        h2: { fontSize: 24, fontWeight: '800', color: c.ink, lineHeight: 30, marginBottom: 12 },
        h3: { fontSize: 18, fontWeight: '800', color: c.ink, marginBottom: 6, letterSpacing: -0.2 },
        lead: { fontSize: 16.5, lineHeight: 25, color: c.muted },
        p: { fontSize: 15.5, lineHeight: 23, color: c.muted },
        body: { fontSize: 15.5, lineHeight: 23, color: c.ink },
        card: { backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 16 },
        section: { marginTop: 36 },
        row: { paddingVertical: 20, borderTopWidth: 1, borderTopColor: c.line },
        rows: { borderBottomWidth: 1, borderBottomColor: c.line },
        err: { color: c.danger, fontSize: 13.5, marginTop: 4 },
        ok: { borderWidth: 1.5, borderColor: c.en, borderRadius: 10, padding: 12, marginBottom: 14, backgroundColor: c.en + '1A' },
        label: { fontWeight: '600', color: c.ink, marginBottom: 6, fontSize: 14 },
        input: { borderWidth: 1.5, borderColor: c.line, borderRadius: 10, backgroundColor: c.panel, color: c.ink, paddingHorizontal: 14, minHeight: 46, fontSize: 16 },
        note: { fontSize: 13.5, color: c.muted, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderLeftWidth: 3, borderLeftColor: c.zh, backgroundColor: c.zh + '1A', borderTopRightRadius: 8, borderBottomRightRadius: 8 },
        fine: { fontSize: 14.5, color: c.muted, lineHeight: 21 },
        link: { color: c.ink, fontWeight: '600', textDecorationLine: 'underline' },
      }),
    [c]
  );
}
