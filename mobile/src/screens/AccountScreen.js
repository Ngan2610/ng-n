import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Field from '../components/Field';
import { Segmented } from '../components/Controls';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useStyles, useTheme } from '../theme';
import { errorKey, HAS_API } from '../api/client';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm({ onSwitch }) {
  const { t } = useI18n();
  const c = useTheme();
  const { login } = useAuth();
  const s = useStyles();
  const [v, setV] = useState({ email: '', pass: '' });
  const [errs, setErrs] = useState({});
  const [srvErr, setSrvErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (val) => setV((prev) => ({ ...prev, [k]: val }));

  async function submit() {
    const er = {};
    if (!EMAIL.test(v.email.trim())) er.email = 'e_email';
    if (v.pass.length < 8) er.pass = 'e_pass';
    setErrs(er);
    setSrvErr('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await login({ email: v.email, password: v.pass });
    } catch (x) {
      setSrvErr(errorKey(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={s.h1}>{t('li_title')}</Text>
      <Text style={[s.lead, { marginTop: 12, marginBottom: 24 }]}>{t('li_sub')}</Text>
      {srvErr ? <Text accessibilityLiveRegion="polite" style={[s.err, { marginBottom: 12 }]}>{t(srvErr)}</Text> : null}
      <Field label={t('f_email')} value={v.email} onChangeText={set('email')} error={errs.email && t(errs.email)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label={t('f_pass')} value={v.pass} onChangeText={set('pass')} error={errs.pass && t(errs.pass)} secureTextEntry autoCapitalize="none" autoComplete="password" />
      <Button title={t('nav_login')} onPress={submit} disabled={busy} />
      <Text style={{ marginTop: 22, color: c.muted, fontSize: 15.5 }}>
        {t('li_no')} <Text style={{ color: c.ink, fontWeight: '600' }} onPress={onSwitch} accessibilityRole="link">{t('rg_title')}</Text>
      </Text>
    </View>
  );
}

function RegisterForm({ onSwitch }) {
  const { t } = useI18n();
  const { register } = useAuth();
  const c = useTheme();
  const s = useStyles();
  const [v, setV] = useState({ name: '', email: '', pass: '', pass2: '', agree: false });
  const [errs, setErrs] = useState({});
  const [srvErr, setSrvErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (val) => setV((prev) => ({ ...prev, [k]: val }));

  async function submit() {
    const er = {};
    if (!v.name.trim()) er.name = 'e_name';
    if (!EMAIL.test(v.email.trim())) er.email = 'e_email';
    if (v.pass.length < 8) er.pass = 'e_pass';
    if (!v.pass2 || v.pass2 !== v.pass) er.pass2 = 'e_pass2';
    if (!v.agree) er.agree = 'e_agree';
    setErrs(er);
    setSrvErr('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await register({ name: v.name, email: v.email, password: v.pass });
    } catch (x) {
      setSrvErr(errorKey(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={s.h1}>{t('rg_title')}</Text>
      <Text style={[s.lead, { marginTop: 12, marginBottom: 24 }]}>{t('rg_sub')}</Text>
      {srvErr ? <Text accessibilityLiveRegion="polite" style={[s.err, { marginBottom: 12 }]}>{t(srvErr)}</Text> : null}
      <Field label={t('f_name')} value={v.name} onChangeText={set('name')} error={errs.name && t(errs.name)} autoComplete="name" />
      <Field label={t('f_email')} value={v.email} onChangeText={set('email')} error={errs.email && t(errs.email)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label={t('f_pass')} value={v.pass} onChangeText={set('pass')} error={errs.pass && t(errs.pass)} secureTextEntry autoCapitalize="none" />
      <Field label={t('f_pass2')} value={v.pass2} onChangeText={set('pass2')} error={errs.pass2 && t(errs.pass2)} secureTextEntry autoCapitalize="none" />
      <View style={{ marginBottom: 16 }}>
        <Text
          accessibilityRole="checkbox"
          accessibilityState={{ checked: v.agree }}
          onPress={() => setV((prev) => ({ ...prev, agree: !prev.agree }))}
          style={{ color: c.ink, fontSize: 15, minHeight: 44, textAlignVertical: 'center' }}
        >
          {v.agree ? '☑' : '☐'}  {t('f_agree')} {t('tm_title')}
        </Text>
        {errs.agree ? <Text style={s.err}>{t(errs.agree)}</Text> : null}
      </View>
      <Button title={t('rg_btn')} onPress={submit} disabled={busy} />
      <Text style={{ marginTop: 22, color: c.muted, fontSize: 15.5 }}>
        {t('rg_have')} <Text style={{ color: c.ink, fontWeight: '600' }} onPress={onSwitch} accessibilityRole="link">{t('nav_login')}</Text>
      </Text>
    </View>
  );
}

export default function AccountScreen() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const s = useStyles();
  const [mode, setMode] = useState('login');

  return (
    <Screen>
      {user ? (
        <View>
          <Text accessibilityRole="header" style={s.h1}>{t('hello')}, {user.name}</Text>
          <Text style={[s.lead, { marginVertical: 12 }]}>{user.email}</Text>
          <Button variant="ghost" title={t('logout')} onPress={logout} />
        </View>
      ) : (
        <View>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[{ key: 'login', label: t('nav_login') }, { key: 'register', label: t('rg_title') }]}
          />
          <View style={{ marginTop: 24 }}>{mode === 'login' ? <LoginForm onSwitch={() => setMode('register')} /> : <RegisterForm onSwitch={() => setMode('login')} />}</View>
          {!HAS_API ? <Text style={s.note}>{t('auth_demo')}</Text> : null}
        </View>
      )}
    </Screen>
  );
}
