import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Brand from './Brand';
import Footer from './Footer';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../theme';
import { LANGS } from '../shared/i18n';

const LABEL = { vi: 'VI', en: 'EN', zh: '中文' };

function LangSwitch() {
  const { L, setL, t } = useI18n();
  const c = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('langlabel')}
      style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden', backgroundColor: c.panel }}
    >
      {LANGS.map((code, n) => (
        <Pressable
          key={code}
          accessibilityRole="radio"
          accessibilityState={{ selected: n === L }}
          onPress={() => setL(n)}
          style={{ minHeight: 38, minWidth: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: n === L ? c.accent : 'transparent' }}
        >
          <Text style={{ color: n === L ? c.onAccent : c.muted, fontWeight: '700', fontSize: 12.5 }}>{LABEL[code]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Khung chung cho mọi màn hình, giống web: thanh đầu (logo + đổi ngôn ngữ), vùng cuộn và chân trang.
 * `bleed`: nội dung tự quản lề trái/phải (dùng với <Section>), không có padding sẵn.
 */
export default function Screen({ children, bleed, scrollRef, footer = true }) {
  const c = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 60, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bg }}>
        <Brand />
        <LangSwitch />
      </View>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={bleed ? null : { padding: 20, paddingTop: 36, paddingBottom: 56 }}>{children}</View>
        {footer ? <Footer /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
