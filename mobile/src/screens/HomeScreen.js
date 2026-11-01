import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Screen from '../components/Screen';
import Section from '../components/Section';
import Button from '../components/Button';
import Scene from '../components/Scenes';
import { useI18n } from '../context/I18nContext';
import { useStyles, useTheme } from '../theme';
import { CUES } from '../shared/i18n';

const TRACKS = [
  ['vi', 'VI'],
  ['en', 'EN'],
  ['zh', '中'],
];
const SUB_COLOR = { vi: '#FF9C8C', en: '#9DB6FF', zh: '#F2CB6B' };
const FEATURES = ['fa', 'fb', 'fc', 'fd', 'fe', 'ff'];
const STEPS = ['s1', 's2', 's3', 's4'];
const BANDS = [
  ['vi', 'Tiếng Việt', 'l_vi_d'],
  ['en', 'English', 'l_en_d'],
  ['zh', '中文', 'l_zh_d'],
];

export default function HomeScreen({ navigation, route }) {
  const { t } = useI18n();
  const c = useTheme();
  const s = useStyles();
  const [i, setI] = useState(0);
  const scrollRef = useRef(null);
  const featuresY = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % CUES.length), 4200);
    return () => clearInterval(id);
  }, [i]);

  const goFeatures = () => scrollRef.current && scrollRef.current.scrollTo({ y: featuresY.current, animated: true });

  // Bấm "Tính năng" ở chân trang các màn khác: về Trang chủ rồi cuộn tới phần tính năng
  const stamp = route && route.params && route.params.scrollTo ? route.params.ts : null;
  useEffect(() => {
    if (stamp) setTimeout(goFeatures, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  return (
    <Screen bleed scrollRef={scrollRef}>
      {/* hero: căn giữa, 2 nút (giống web) */}
      <Section style={{ paddingTop: 48, paddingBottom: 40, alignItems: 'center' }}>
        <Text accessibilityRole="header" style={[s.h1, { fontSize: 38, lineHeight: 42, textAlign: 'center' }]}>{t('h_title')}</Text>
        <Text style={[s.lead, { marginTop: 18, textAlign: 'center' }]}>{t('h_sub')}</Text>
        <View style={{ marginTop: 28, gap: 12, alignSelf: 'stretch' }}>
          <Button title={t('h_cta1')} onPress={() => navigation.navigate('Demo')} />
          <Button variant="ghost" title={t('h_cta2')} onPress={goFeatures} />
        </View>

        {/* video mẫu: khung 16:9 + phụ đề 3 ngôn ngữ như `.stage` / `.subs` trên web */}
        <View style={{ alignSelf: 'stretch', marginTop: 32 }}>
          <View style={{ aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: c.line }}>
            <Scene index={i % 4} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 4, backgroundColor: 'rgba(10,28,24,0.88)' }}>
              {TRACKS.map(([lang, tag]) => (
                <View key={lang} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ width: 26, fontSize: 11.5, fontWeight: '700', color: SUB_COLOR[lang], paddingTop: 2 }}>{tag}</Text>
                  <Text style={{ flex: 1, color: '#fff', fontSize: 14, lineHeight: 20 }}>{CUES[i][lang]}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {CUES.map((_, n) => (
              <View key={n} accessibilityLabel={t('step') + ' ' + (n + 1)} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: n === i ? c.ink : c.line }} />
            ))}
          </View>
        </View>
      </Section>

      {/* 4 bước: mỗi bước có vạch đen phía trên, số lớn màu mờ */}
      <Section alt>
        <Text accessibilityRole="header" style={s.h2}>{t('how_title')}</Text>
        <View style={{ gap: 28, marginTop: 12 }}>
          {STEPS.map((k, n) => (
            <View key={k} style={{ borderTopWidth: 2, borderTopColor: c.ink, paddingTop: 18 }}>
              <Text style={{ fontSize: 42, lineHeight: 42, fontWeight: '800', color: c.muted }}>{n + 1}</Text>
              <Text style={[s.h3, { fontSize: 19, marginTop: 14, marginBottom: 8 }]}>{t(k + 't')}</Text>
              <Text style={s.p}>{t(k + 'd')}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* tính năng: các hàng có đường kẻ như `.rows` */}
      <Section onLayout={(e) => { featuresY.current = e.nativeEvent.layout.y; }}>
        <Text accessibilityRole="header" style={s.h2}>{t('ft_title')}</Text>
        <View style={[s.rows, { marginTop: 4 }]}>
          {FEATURES.map((k) => (
            <View key={k} style={s.row}>
              <Text style={s.h3}>{t(k + '_t')}</Text>
              <Text style={s.p}>{t(k + '_d')}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section>
        <Text accessibilityRole="header" style={s.h2}>{t('langs_title')}</Text>
        <View style={{ marginTop: 12 }}>
          {BANDS.map(([lang, name, key], n) => (
            <View
              key={lang}
              style={{ borderLeftWidth: 5, borderLeftColor: c[lang], borderTopWidth: 1, borderTopColor: c.line, borderBottomWidth: n === BANDS.length - 1 ? 1 : 0, borderBottomColor: c.line, paddingLeft: 18, paddingVertical: 22 }}
            >
              <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: '800', color: c[lang], marginBottom: 6 }}>{name}</Text>
              <Text style={s.p}>{t(key)}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section alt>
        <Text style={[s.h2, { fontSize: 28, lineHeight: 34 }]}>{t('cta_title')}</Text>
        <Text style={[s.p, { marginBottom: 22 }]}>{t('cta_sub')}</Text>
        <Button title={t('cta_btn')} onPress={() => navigation.navigate('Account')} />
      </Section>
    </Screen>
  );
}
