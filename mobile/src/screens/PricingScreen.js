import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Field from '../components/Field';
import { Segmented } from '../components/Controls';
import { useI18n } from '../context/I18nContext';
import { useStyles, useTheme } from '../theme';
import { formatMoney, planPrice } from '../shared/format';
import { calcPrice, checkCounts, parseCount, SAMPLE_PACKS, unitPrice } from '../shared/pricing';

const PLANS = [1, 2, 3];
const qh = (c) => ({ textAlign: 'right', color: c.muted, fontWeight: '600', fontSize: 12.5 });
const qc = (c) => ({ textAlign: 'right', color: c.ink, fontSize: 14, fontVariant: ['tabular-nums'] });

/** Dòng có dấu ✓ màu xanh như `.plan li` trên web. */
function Check({ children }) {
  const c = useTheme();
  const s = useStyles();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ color: c.en, fontWeight: '800', fontSize: 15.5, lineHeight: 23 }}>✓</Text>
      <Text style={[s.body, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

export default function PricingScreen({ navigation }) {
  const { t, L } = useI18n();
  const c = useTheme();
  const s = useStyles();
  const [yearly, setYearly] = useState(false);
  const [uploads, setUploads] = useState('3');
  const [outs, setOuts] = useState('3');
  const [pickedPack, setPickedPack] = useState(null);

  const u = parseCount(uploads);
  const o = parseCount(outs);
  const err = checkCounts(u, o);
  const price = err ? null : calcPrice(L, u, o);
  // Lỗi "nhập sai số" gắn vào ô bị sai; lỗi "dịch ra quá nhiều" gắn vào ô số video dịch ra.
  const upErr = u === null ? 'pc_bad' : null;
  const outErr = o === null ? 'pc_bad' : err === 'pc_over' ? 'pc_over' : null;

  const changeUploads = (v) => { setUploads(v); setPickedPack(null); };
  const changeOuts = (v) => { setOuts(v); setPickedPack(null); };
  const applyPack = (pack) => {
    setUploads(String(pack.uploads));
    setOuts(String(pack.outs));
    setPickedPack(pack.id);
  };

  return (
    <Screen>
      <Text accessibilityRole="header" style={s.h1}>{t('pr_title')}</Text>
      <Text style={[s.lead, { marginTop: 14 }]}>{t('pr_sub')}</Text>

      <View style={s.section}>
        <Text accessibilityRole="header" style={s.h2}>{t('pc_title')}</Text>
        <Field
          label={t('pc_up')}
          value={uploads}
          onChangeText={changeUploads}
          error={upErr && t(upErr)}
          keyboardType="number-pad"
        />
        <Field
          label={t('pc_out')}
          value={outs}
          onChangeText={changeOuts}
          error={outErr && t(outErr)}
          keyboardType="number-pad"
        />
        <Text style={[s.fine, { marginBottom: 16 }]}>{t('pc_hint')}</Text>
        {price ? (
          <View style={[s.card, { padding: 20 }]}>
            <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <Text style={{ flex: 1.3 }} />
              <Text style={[qh(c), { flex: 0.6 }]}>{t('pc_qty')}</Text>
              <Text style={[qh(c), { flex: 1.2 }]}>{t('pc_unit')}</Text>
              <Text style={[qh(c), { flex: 1.4 }]}>{t('pc_amount')}</Text>
            </View>
            {[
              [t('pc_row_up'), u, unitPrice(L, 0), price.up],
              [t('pc_row_out'), o, unitPrice(L, 1), price.out],
            ].map(([name, qty, unit, amount]) => (
              <View key={name} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <Text style={{ flex: 1.3, fontWeight: '600', color: c.ink, fontSize: 14.5 }}>{name}</Text>
                <Text style={[qc(c), { flex: 0.6 }]}>{qty}</Text>
                <Text style={[qc(c), { flex: 1.2 }]}>{formatMoney(L, unit)}</Text>
                <Text style={[qc(c), { flex: 1.4 }]}>{formatMoney(L, amount)}</Text>
              </View>
            ))}
            <Text style={[s.p, { marginTop: 16 }]}>{t('pc_total')}</Text>
            <Text testID="pc-total" accessibilityLiveRegion="polite" style={{ fontSize: 36, fontWeight: '800', color: c.ink, letterSpacing: -0.5 }}>
              {formatMoney(L, price.total)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={s.section}>
        <Text accessibilityRole="header" style={s.h2}>{t('pk_title')}</Text>
        <Text style={[s.fine, { marginBottom: 16 }]}>{t('pk_sub')}</Text>
        <View style={{ gap: 16 }}>
          {SAMPLE_PACKS.map((pack) => (
            <View key={pack.id} style={[s.card, { padding: 20 }]}>
              <Text accessibilityRole="header" style={[s.h3, { fontSize: 19 }]}>{t('pk' + pack.id + '_n')}</Text>
              <Text style={[s.p, { marginTop: 4 }]}>{t('pk' + pack.id + '_d')}</Text>
              <View style={{ marginVertical: 12, gap: 6 }}>
                <Check>{pack.uploads} {t('pk_vid')}</Check>
                <Check>{pack.outs} {t('pk_out')}</Check>
              </View>
              <Text testID={'pk-price-' + pack.id} style={{ fontSize: 28, fontWeight: '800', color: c.ink, marginBottom: 14 }}>
                {formatMoney(L, calcPrice(L, pack.uploads, pack.outs).total)}
              </Text>
              <Button variant="ghost" title={t('pk_use')} onPress={() => applyPack(pack)} />
              {pickedPack === pack.id ? (
                <Text accessibilityLiveRegion="polite" style={[s.note, { marginTop: 10 }]}>{t('pk_filled')}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text accessibilityRole="header" style={s.h2}>{t('pl_title')}</Text>
        <Segmented
          value={yearly ? 'y' : 'm'}
          onChange={(k) => setYearly(k === 'y')}
          options={[{ key: 'm', label: t('pr_monthly') }, { key: 'y', label: t('pr_yearly') }]}
        />
        <View style={{ marginTop: 22, gap: 16 }}>
          {PLANS.map((n, p) => {
            const pick = p === 1;
            return (
              <View key={n} style={[s.card, { padding: 22, borderWidth: pick ? 2 : 1, borderColor: pick ? c.ink : c.line }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[s.h3, { fontSize: 20 }]}>{t('pl' + n)}</Text>
                  {pick ? (
                    <View style={{ backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: c.onAccent, fontSize: 12, fontWeight: '600' }}>{t('pl_pick')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 32, fontWeight: '800', color: c.ink, marginTop: 10 }}>
                  {formatMoney(L, planPrice(L, p, yearly))}
                  <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}> {t('pr_per')}</Text>
                </Text>
                <View style={{ marginVertical: 16, gap: 8 }}>
                  {[1, 2, 3].map((k) => (
                    <Check key={k}>{t('pl' + n + '_' + k)}</Check>
                  ))}
                </View>
                <Button
                  variant={pick ? 'primary' : 'ghost'}
                  title={p === 0 ? t('pl_c1') : t('pl_c')}
                  onPress={() => navigation.navigate('Account')}
                />
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
