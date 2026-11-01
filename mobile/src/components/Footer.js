import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Brand from './Brand';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../theme';

/** Chân trang giống web: logo + giới thiệu, 3 cột liên kết, bản quyền. */
export default function Footer() {
  const { t } = useI18n();
  const c = useTheme();
  const nav = useNavigation();

  const COLS = [
    ['ft_product', [
      ['nav_features', 'Home', { scrollTo: 'features' }],
      ['nav_demo', 'Demo'],
      ['nav_pricing', 'Pricing'],
    ]],
    ['ft_company', [
      ['nav_about', 'Info', { tab: 'about' }],
      ['nav_faq', 'Info', { tab: 'faq' }],
      ['nav_contact', 'Info', { tab: 'contact' }],
    ]],
    ['ft_legal', [
      ['tm_title', 'Info', { tab: 'legal' }],
      ['pv_title', 'Info', { tab: 'legal' }],
    ]],
  ];

  return (
    <View style={{ backgroundColor: c.panel, borderTopWidth: 1, borderTopColor: c.line, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 28 }}>
      <Brand />
      <Text style={{ color: c.muted, fontSize: 14.5, lineHeight: 21, marginTop: 12, maxWidth: 320 }}>{t('ft_tag')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 28, rowGap: 24 }}>
        {COLS.map(([title, links]) => (
          <View key={title} style={{ width: '50%', paddingRight: 12 }}>
            <Text accessibilityRole="header" style={{ fontWeight: '600', fontSize: 14.5, color: c.ink, marginBottom: 8 }}>{t(title)}</Text>
            {links.map(([key, screen, params]) => (
              <Pressable
                key={key}
                accessibilityRole="link"
                hitSlop={{ top: 6, bottom: 6 }}
                onPress={() => nav.navigate(screen, params ? { ...params, ts: Date.now() } : undefined)}
                style={{ minHeight: 32, justifyContent: 'center' }}
              >
                <Text style={{ color: c.muted, fontSize: 14.5 }}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <View style={{ marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: c.line, gap: 4 }}>
        <Text style={{ color: c.muted, fontSize: 13.5 }}>{t('ft_copy')}</Text>
        <Text style={{ color: c.muted, fontSize: 13.5 }}>hello@dubchef.example</Text>
      </View>
    </View>
  );
}
