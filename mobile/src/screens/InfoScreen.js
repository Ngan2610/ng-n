import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Field from '../components/Field';
import { Segmented } from '../components/Controls';
import { useI18n } from '../context/I18nContext';
import { useStyles, useTheme } from '../theme';
import { api, errorKey, HAS_API } from '../api/client';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALUES = ['v1', 'v2', 'v3'];
const FAQ = [1, 2, 3, 4, 5, 6];

function About({ onDemo }) {
  const { t } = useI18n();
  const s = useStyles();
  return (
    <View>
      <Text accessibilityRole="header" style={s.h1}>{t('a_title')}</Text>
      <Text style={[s.body, { marginTop: 18, fontSize: 16.5 }]}>{t('a_p1')}</Text>
      <Text style={[s.body, { marginTop: 16, fontSize: 16.5 }]}>{t('a_p2')}</Text>
      <Text style={[s.h2, { marginTop: 44 }]}>{t('a_v_title')}</Text>
      <View style={s.rows}>
        {VALUES.map((k) => (
          <View key={k} style={s.row}>
            <Text style={s.h3}>{t(k + '_t')}</Text>
            <Text style={s.p}>{t(k + '_d')}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 32 }}>
        <Button title={t('a_cta')} onPress={onDemo} />
      </View>
    </View>
  );
}

function Faq({ onContact }) {
  const { t } = useI18n();
  const c = useTheme();
  const s = useStyles();
  const [open, setOpen] = useState(0);
  return (
    <View>
      <Text accessibilityRole="header" style={s.h1}>{t('fq_title')}</Text>
      <View style={[s.rows, { marginTop: 20 }]}>
        {FAQ.map((n) => (
          <View key={n} style={[s.row, { paddingVertical: 0 }]}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === n }} onPress={() => setOpen(open === n ? 0 : n)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 16 }}>
              <Text style={{ flex: 1, fontWeight: '600', fontSize: 16.5, color: c.ink }}>{t('q' + n)}</Text>
              <Text style={{ fontSize: 26, color: c.muted, lineHeight: 28 }}>{open === n ? '\u2212' : '+'}</Text>
            </Pressable>
            {open === n ? <Text style={[s.p, { paddingBottom: 20 }]}>{t('a' + n)}</Text> : null}
          </View>
        ))}
      </View>
      <View style={{ marginTop: 32 }}>
        <Text style={{ fontWeight: '600', color: c.ink, marginBottom: 14 }}>{t('fq_more')}</Text>
        <Button variant="ghost" title={t('nav_contact')} onPress={onContact} />
      </View>
    </View>
  );
}

function Contact() {
  const { t } = useI18n();
  const c = useTheme();
  const s = useStyles();
  const [v, setV] = useState({ name: '', email: '', msg: '' });
  const [errs, setErrs] = useState({});
  const [ok, setOk] = useState(false);
  const [srvErr, setSrvErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (val) => setV((prev) => ({ ...prev, [k]: val }));

  async function submit() {
    const er = {};
    if (!v.name.trim()) er.name = 'e_name';
    if (!EMAIL.test(v.email.trim())) er.email = 'e_email';
    if (!v.msg.trim()) er.msg = 'e_msg';
    setErrs(er);
    setOk(false);
    setSrvErr('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await api.contact({ name: v.name.trim(), email: v.email.trim(), message: v.msg.trim() });
      setOk(true);
      setV({ name: '', email: '', msg: '' });
    } catch (x) {
      setSrvErr(errorKey(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={s.h1}>{t('c_title')}</Text>
      <Text style={[s.lead, { marginTop: 14, marginBottom: 24 }]}>{t('c_sub')}</Text>
      {ok ? <Text accessibilityLiveRegion="polite" style={[s.ok, { color: c.ink }]}>{t('c_ok')}</Text> : null}
      {srvErr ? <Text style={[s.err, { marginBottom: 12 }]}>{t(srvErr)}</Text> : null}
      <Field label={t('f_name')} value={v.name} onChangeText={set('name')} error={errs.name && t(errs.name)} autoComplete="name" />
      <Field label={t('f_email')} value={v.email} onChangeText={set('email')} error={errs.email && t(errs.email)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label={t('f_msg')} value={v.msg} onChangeText={set('msg')} error={errs.msg && t(errs.msg)} multiline numberOfLines={5} style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }} />
      <Button title={t('c_send')} onPress={submit} disabled={busy} />
      {!HAS_API ? <Text style={s.note}>{t('auth_demo')}</Text> : null}
      <View style={{ marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: c.line, gap: 10 }}>
        <Text accessibilityRole="header" style={[s.h3, { fontSize: 19 }]}>{t('c_info_t')}</Text>
        <Text style={s.link} onPress={() => Linking.openURL('mailto:hello@dubchef.example')}>hello@dubchef.example</Text>
        <Text style={s.p}>{t('c_hours')}</Text>
      </View>
    </View>
  );
}

function Legal() {
  const { t } = useI18n();
  const s = useStyles();
  const block = (titleKey, prefix) => (
    <View style={{ marginBottom: 40 }}>
      <Text accessibilityRole="header" style={s.h1}>{t(titleKey)}</Text>
      <Text style={[s.p, { marginBottom: 12 }]}>{t('upd')}</Text>
      {[1, 2, 3, 4].map((n) => (
        <View key={n} style={{ marginTop: 14 }}>
          <Text style={[s.h3, { fontSize: 17 }]}>{t(prefix + n + '_t')}</Text>
          <Text style={s.p}>{t(prefix + n + '_d')}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <View>
      {block('tm_title', 'tm')}
      {block('pv_title', 'pv')}
    </View>
  );
}

export default function InfoScreen({ navigation, route }) {
  const { t } = useI18n();
  const [tab, setTab] = useState('about');
  // Chân trang các màn khác mở thẳng tới mục Giới thiệu / FAQ / Liên hệ / Điều khoản
  const want = route && route.params && route.params.tab;
  const stamp = route && route.params && route.params.ts;
  useEffect(() => {
    if (want) setTab(want);
  }, [want, stamp]);
  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'about', label: t('nav_about') },
          { key: 'faq', label: 'FAQ' },
          { key: 'contact', label: t('nav_contact') },
          { key: 'legal', label: t('ft_legal') },
        ]}
      />
      <View style={{ marginTop: 24 }}>
        {tab === 'about' ? <About onDemo={() => navigation.navigate('Demo')} /> : null}
        {tab === 'faq' ? <Faq onContact={() => setTab('contact')} /> : null}
        {tab === 'contact' ? <Contact /> : null}
        {tab === 'legal' ? <Legal /> : null}
      </View>
    </Screen>
  );
}
