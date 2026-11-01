import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Video } from 'expo-av';
import * as Speech from 'expo-speech';
import * as DocumentPicker from 'expo-document-picker';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { Chip } from '../components/Controls';
import { useI18n } from '../context/I18nContext';
import { useStyles, useTheme } from '../theme';
import { translateLines, TranslateError } from '../shared/translate';
import { transcribeVideoFile, isNativeSTTAvailable, SttError } from '../utils/sttNative';

const STAGES_MANUAL = ['dp1', 'dp2', 'dp3', 'dp4'];
const STAGES_AUTO = ['dp0', 'dp1', 'dp2', 'dp3', 'dp4'];
const LANGCODE = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' };
const TAG = { vi: 'VI', en: 'EN', zh: '中文' };
const SPEEDS = [0.8, 1, 1.25];
const ERR_KEY = { net: 'e_net', server: 'd_translate_err', empty: 'd_translate_err', limit: 'd_translate_limit' };
const STT_ERR_KEY = { unavailable: 'd_stt_unavailable', download: 'd_stt_err', extract: 'd_stt_err', decode: 'd_stt_err', empty: 'd_stt_err' };
const STT_PHASE_KEY = { model: 'd_stt_model', extract: 'd_stt_model', listen: 'd_stt_listen' };

export default function DemoScreen() {
  const { t, lang } = useI18n();
  const c = useTheme();
  const s = useStyles();
  const videoRef = useRef(null);

  // --- video + lời thoại ---
  const [file, setFile] = useState(null);
  const [script, setScript] = useState('');
  const [sourceLang, setSourceLang] = useState(lang);
  const [needFile, setNeedFile] = useState(false);
  const [needScript, setNeedScript] = useState(false);

  // --- quy trình dịch thật ---
  const hasScript = script.trim().length > 0;
  const isAuto = Boolean(file) && !hasScript; // có video, chưa gõ lời thoại -> tự nhận diện giọng nói
  const STAGES = isAuto ? STAGES_AUTO : STAGES_MANUAL;
  const [showPipe, setShowPipe] = useState(false);
  const [stages, setStages] = useState(STAGES_MANUAL.map(() => 'wait'));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [translateErr, setTranslateErr] = useState('');
  const [sttPhase, setSttPhase] = useState('');

  // --- kết quả dịch thật + phát lại ---
  const [segments, setSegments] = useState(null);
  const [i, setI] = useState(0);
  const [voice, setVoice] = useState(lang);
  const [subs, setSubs] = useState({ [lang]: true });
  const [speed, setSpeed] = useState(1);
  const [voices, setVoices] = useState([]);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then(setVoices).catch(() => {});
    return () => Speech.stop();
  }, []);

  const voiceMissing =
    segments != null &&
    voice !== 'off' &&
    voices.length > 0 &&
    !voices.some((v) => String(v.language).toLowerCase().replace('_', '-').startsWith(voice));

  // Đọc thuyết minh khi sang đoạn mới
  useEffect(() => {
    if (!segments || voice === 'off' || voiceMissing) return undefined;
    Speech.stop();
    Speech.speak(segments[i][voice], { language: LANGCODE[voice], rate: speed });
    return () => Speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, voice, segments]);

  // true nếu các đoạn có mốc thời gian THẬT từ Whisper (auto mode), false nếu chia đều (manual mode)
  const hasRealTime = !!(segments && segments.length && segments[0] && segments[0].start != null);

  const onStatusUpdate = (status) => {
    if (!status.isLoaded || !segments || !segments.length || !duration) return;
    let seg;
    if (hasRealTime) {
      const posSec = status.positionMillis / 1000;
      seg = segments.findIndex((s, n) => posSec < s.end || n === segments.length - 1);
      if (seg < 0) seg = segments.length - 1;
    } else {
      seg = Math.min(segments.length - 1, Math.floor((status.positionMillis / duration) * segments.length));
    }
    if (seg !== i) setI(seg);
  };

  const jump = async (n) => {
    setI(n);
    if (!videoRef.current || !segments) return;
    if (hasRealTime) {
      await videoRef.current.setPositionAsync(segments[n].start * 1000);
    } else if (duration) {
      await videoRef.current.setPositionAsync((n / segments.length) * duration);
    }
  };

  const toggleSub = (l) => setSubs((prev) => {
    const next = { ...prev };
    if (next[l]) delete next[l]; else next[l] = true;
    return next;
  });

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      if (!res.canceled && res.assets && res.assets[0]) {
        setFile(res.assets[0]);
        setNeedFile(false);
      }
    } catch (e) { /* người dùng hủy */ }
  };

  const start = async () => {
    if (running) return;
    setNeedFile(!file);
    setNeedScript(false); // kịch bản được phép để trống nếu đã tải video lên -> tự nhận diện giọng nói
    if (!file) return;

    const auto = !hasScript;
    const stageList = auto ? STAGES_AUTO : STAGES_MANUAL;
    const run = (n) => stageList.map((v, idx) => (idx < n ? 'done' : idx === n ? 'run' : 'wait'));

    setTranslateErr('');
    setDone(false);
    setShowPipe(true);
    setRunning(true);
    setSttPhase('');
    setStages(run(0));

    try {
      let lines = script.split('\n');
      let timestamps = null; // [{start,end}] theo thời gian thật nếu có (chỉ auto mode mới có)

      if (auto) {
        if (!isNativeSTTAvailable()) throw new SttError('unavailable');
        setStages(run(0));
        const chunks = await transcribeVideoFile(file.uri, sourceLang, (phase) => setSttPhase(STT_PHASE_KEY[phase] || ''));
        setSttPhase('');
        lines = chunks.map((c) => c.text);
        timestamps = chunks.map((c) => ({ start: c.start, end: c.end }));
        setStages(run(1));
      } else {
        setStages(run(auto ? 1 : 0));
      }

      const translated = await translateLines(lines, sourceLang);
      if (!translated.length) throw new TranslateError('empty');
      const withTime = timestamps
        ? translated.map((seg, n) => ({ ...seg, start: timestamps[n]?.start, end: timestamps[n]?.end }))
        : translated;

      setStages(run(auto ? 2 : 1));
      await new Promise((r) => setTimeout(r, 150));
      setStages(run(auto ? 3 : 2));

      setSegments(withTime);
      setI(0);
      setSubs({ [lang]: true });
      setStages(stageList.map(() => 'done'));
      setDone(true);
    } catch (e) {
      const key = e instanceof SttError
        ? STT_ERR_KEY[e.code] || 'd_stt_err'
        : e instanceof TranslateError
          ? ERR_KEY[e.code] || 'd_translate_err'
          : 'd_translate_err';
      setTranslateErr(key);
      setStages((prev) => prev.map((v) => (v === 'run' ? 'wait' : v)));
    } finally {
      setRunning(false);
      setSttPhase('');
    }
  };

  const shown = segments ? ['vi', 'en', 'zh'].filter((l) => subs[l]) : [];

  return (
    <Screen>
      <Text accessibilityRole="header" style={s.h1}>{t('d_title')}</Text>
      <Text style={[s.lead, { marginTop: 14, marginBottom: 28 }]}>{t('d_sub_m')}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={pick}
        style={{ minHeight: file ? 110 : 200, borderWidth: 2, borderStyle: file ? 'solid' : 'dashed', borderColor: c.line, borderRadius: 16, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 }}
      >
        <Text style={{ fontWeight: '600', color: c.ink, textAlign: 'center' }}>{t('m_pick')}</Text>
        {file ? <Text style={{ color: c.muted, fontSize: 13 }}>{t('d_chosen') + file.name}</Text> : null}
      </Pressable>
      {needFile ? <Text accessibilityLiveRegion="polite" style={s.err}>{t('d_need')}</Text> : null}

      <Text style={[s.label, { marginTop: 18 }]}>{t('d_script_label')}</Text>
      <TextInput
        accessibilityLabel={t('d_script_label')}
        value={script}
        onChangeText={(v) => { setScript(v); setNeedScript(false); }}
        placeholder={t('d_script_placeholder')}
        placeholderTextColor={c.muted}
        multiline
        numberOfLines={5}
        style={[s.input, { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }]}
      />
      {needScript ? <Text accessibilityLiveRegion="polite" style={s.err}>{t('d_need_script')}</Text> : null}

      <Text style={[s.label, { marginTop: 16 }]}>{t('d_source_lang')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Chip label="Tiếng Việt" selected={sourceLang === 'vi'} onPress={() => setSourceLang('vi')} />
        <Chip label="English" selected={sourceLang === 'en'} onPress={() => setSourceLang('en')} />
        <Chip label="中文" selected={sourceLang === 'zh'} onPress={() => setSourceLang('zh')} />
      </View>

      <Button title={running ? t('d_translating') : t('d_translate_btn')} onPress={start} disabled={running} />
      {translateErr ? <Text accessibilityLiveRegion="polite" style={[s.err, { marginTop: 10 }]}>{t(translateErr)}</Text> : null}

      {showPipe ? (
        <View style={{ marginTop: 20, gap: 10 }}>
          {STAGES.map((key, n) => (
            <View key={key} style={{ padding: 14, borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: c.panel, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={[s.body, { flex: 1 }]}>{t(key)}</Text>
                <Text style={{ color: stages[n] === 'done' ? c.en : c.muted, fontWeight: stages[n] === 'done' ? '600' : '400', fontSize: 13.5 }}>{t('st_' + stages[n])}</Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: stages[n] === 'wait' ? '0%' : stages[n] === 'run' ? '55%' : '100%', backgroundColor: c.ink }} />
              </View>
            </View>
          ))}
          {sttPhase ? <Text style={[s.note, { marginTop: -2 }]}>{t(sttPhase)}</Text> : null}
        </View>
      ) : null}
      {done ? <Text accessibilityLiveRegion="polite" style={[s.ok, { marginTop: 16, color: c.ink }]}>{t('d_done')}</Text> : null}

      {segments ? (
        <>
          <Text style={[s.h3, { marginTop: 28, marginBottom: 10 }]}>{t('d_sample') + file.name}</Text>
          <View style={{ aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: c.line }}>
            <Video
              ref={videoRef}
              source={{ uri: file.uri }}
              style={{ width: '100%', height: '100%' }}
              useNativeControls
              resizeMode="contain"
              isMuted={voice !== 'off'}
              rate={speed}
              onLoad={(status) => setDuration(status.durationMillis || 0)}
              onPlaybackStatusUpdate={onStatusUpdate}
            />
            {shown.length > 0 ? (
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, gap: 4, backgroundColor: 'rgba(10,28,24,0.88)' }}>
                {shown.map((l) => (
                  <View key={l} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ width: 28, fontSize: 11, fontWeight: '700', color: l === 'vi' ? '#FF9C8C' : l === 'en' ? '#9DB6FF' : '#F2CB6B' }}>{TAG[l]}</Text>
                    <Text style={{ flex: 1, color: '#fff', fontSize: 12.5, lineHeight: 17 }}>{segments[i][l]}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
            {segments.map((_, n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={t('step') + ' ' + (n + 1)}
                onPress={() => jump(n)}
                hitSlop={{ top: 12, bottom: 12 }}
                style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: n === i ? c.ink : c.line }}
              />
            ))}
          </View>

          <Text style={[s.label, { marginTop: 18 }]}>{t('d_voice')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Tiếng Việt" selected={voice === 'vi'} onPress={() => setVoice('vi')} />
            <Chip label="English" selected={voice === 'en'} onPress={() => setVoice('en')} />
            <Chip label="中文" selected={voice === 'zh'} onPress={() => setVoice('zh')} />
            <Chip label={t('d_off')} selected={voice === 'off'} onPress={() => setVoice('off')} />
          </View>
          {voice !== 'off' ? <Text style={s.note}>{t('d_mute_note')}</Text> : null}

          <Text style={[s.label, { marginTop: 16 }]}>{t('d_subs')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['vi', 'en', 'zh'].map((l) => (
              <Chip key={l} label={TAG[l]} selected={!!subs[l]} onPress={() => toggleSub(l)} />
            ))}
          </View>

          <Text style={[s.label, { marginTop: 16 }]}>{t('d_speed')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SPEEDS.map((v) => (
              <Chip key={v} label={v + '×'} selected={speed === v} onPress={() => setSpeed(v)} />
            ))}
          </View>

          {voiceMissing ? <Text style={s.note}>{t('d_nospeech')}</Text> : null}

          <Text style={[s.h3, { marginTop: 28, marginBottom: 10 }]}>{t('d_steps')}</Text>
          <View style={{ gap: 8 }}>
            {segments.map((seg, n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                onPress={() => jump(n)}
                style={{ backgroundColor: c.panel, borderWidth: 1, borderColor: n === i ? c.ink : c.line, borderLeftWidth: n === i ? 4 : 1, borderRadius: 10, padding: 12 }}
              >
                <Text style={[s.body, { fontSize: 14.5 }]}>{seg[lang]}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
