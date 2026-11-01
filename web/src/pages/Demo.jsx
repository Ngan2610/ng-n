import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { projectApi, projectError } from '../api/projectApi.js';
import './Account.css';
import { useI18n } from '../context/I18nContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import { translateLines, TranslateError } from '../shared/translate.js';
import { availableVoiceLangs, firstAvailableVoice, hasSpeech, speakQueue, stopSpeech, uniformRate, voiceFor, voicesLoaded } from '../utils/speech.js';
import { mergeChunks } from '../utils/segments.js';
import { fileToWhisperAudio, AudioExtractError } from '../utils/audio.js';
import { transcribeVideoAudio } from '../utils/whisper.js';

const STAGES_INIT = ['dp0', 'dp1', 'dp3', 'dp4'];
const LANG_TAG = { vi: 'VI', en: 'EN', zh: '中文' };
const ERR_KEY = { net: 'e_net', server: 'd_translate_err', empty: 'd_translate_err', limit: 'd_translate_limit' };

export default function Demo() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [resultLanguage, setResultLanguage] = useState(lang);
  usePageTitle('d_title');

  // --- video + lời thoại ---
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [objectUrl, setObjectUrl] = useState('');
  const [sourceLang, setSourceLang] = useState(lang);
  const [needInput, setNeedInput] = useState(false);
  const [over, setOver] = useState(false);

  // --- quy trình dịch thật ---
  const [translate, setTranslate] = useState(false); // false = chỉ lồng tiếng đúng ngôn ngữ gốc, không dịch
  const [stageKeys, setStageKeys] = useState(STAGES_INIT);
  const [sttPhase, setSttPhase] = useState(''); // 'model' | 'listening' | ''
  const [showPipe, setShowPipe] = useState(false);
  const [stages, setStages] = useState(STAGES_INIT.map(() => 'wait'));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [translateErr, setTranslateErr] = useState('');
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const stageRef = useRef(null);

  // --- kết quả dịch thật ---
  // segments: [{ vi, en, zh, start?, end? }, ...] hoặc null trước khi dịch.
  // start/end (giây) chỉ có khi tự nhận diện bằng Whisper — cho phép đồng bộ đúng theo lời nói thật
  // thay vì chia đều thời lượng video như khi người dùng tự gõ lời thoại.
  const [segments, setSegments] = useState(null);

  // --- phát lại ---
  const [i, setI] = useState(0);
  const [voice, setVoice] = useState(lang);
  const [subs, setSubs] = useState({ [lang]: true });
  const [speed, setSpeed] = useState(1);
  const [, refreshVoices] = useState(0);

  useEffect(() => {
    if (!hasSpeech) return undefined;
    const bump = () => refreshVoices((n) => n + 1);
    window.speechSynthesis.addEventListener('voiceschanged', bump);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', bump);
  }, []);

  useEffect(() => () => {
    stopSpeech();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  // Đồng bộ tốc độ và tắt/mở tiếng gốc theo lựa chọn giọng đọc
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    v.muted = voice !== 'off';
  }, [speed, voice, segments]);

  const segFromTime = (v) => {
    if (!segments || !segments.length) return 0;
    if (segments[0].start != null) {
      let seg = 0;
      for (let n = 0; n < segments.length; n += 1) {
        if (v.currentTime >= segments[n].start) seg = n; else break;
      }
      return seg;
    }
    if (!v.duration) return 0;
    return Math.min(segments.length - 1, Math.floor((v.currentTime / v.duration) * segments.length));
  };

  // Khi có giọng đọc thì giọng đọc "cầm lái" (phụ đề chạy theo giọng); khi tắt tiếng / máy thiếu giọng thì theo thời gian video.
  const voiceDriven = voice !== 'off' && !!voiceFor(voice);
  const resyncRef = useRef(false); // true khi chính mình vừa đặt lại currentTime (không coi là người dùng tua)
  const jumpRef = useRef(null);

  // Đọc LIỀN MẠCH từ đoạn `from` tới hết: xếp hàng cả dãy, câu nào đọc xong mới sang câu kế, không bị cắt ngang.
  const speakFrom = (from) => {
    if (!segments || voice === 'off') return;
    const vc = voiceFor(voice);
    if (!vc) return;
    // Cùng một tốc độ cho mọi câu → giọng đều, không lúc nhanh lúc chậm
    const rate = uniformRate(segments, voice, speed);
    const items = segments.slice(from).map((seg) => ({ text: seg[voice], rate }));
    speakQueue(items, {
      lang: voice,
      voice: vc,
      onStart: (k) => {
        const n = from + k;
        setI(n);
        const vid = videoRef.current;
        const seg = segments[n];
        if (!vid || seg.start == null) return;
        // Giọng và hình lệch nhau thì chỉnh NHẸ tốc độ hình (chậm lại / nhanh lên một chút) để hai bên tự khớp,
        // không tua giật. Chỉ tua hẳn khi lệch quá 4 giây. Bỏ qua câu đầu: người dùng vừa chủ động tua tới đó.
        if (k === 0) return;
        const drift = vid.currentTime - seg.start; // > 0: hình đang chạy trước giọng
        if (Math.abs(drift) > 4) {
          resyncRef.current = true;
          vid.currentTime = seg.start;
          vid.playbackRate = speed;
        } else if (drift > 0.4) vid.playbackRate = speed * 0.8;
        else if (drift < -0.4) vid.playbackRate = speed * 1.25;
        else vid.playbackRate = speed;
      },
    });
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !segments || voiceDriven) return;
    const seg = segFromTime(v);
    if (seg !== i) setI(seg);
  };

  const onPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    const seg = segFromTime(v);
    setI(seg);
    speakFrom(seg);
  };

  const onSeeked = () => {
    const v = videoRef.current;
    if (!v || !segments) return;
    if (resyncRef.current) { resyncRef.current = false; return; }
    const seg = jumpRef.current != null ? jumpRef.current : segFromTime(v);
    jumpRef.current = null;
    setI(seg);
    if (!v.paused) speakFrom(seg);
  };

  // Đổi giọng/tốc độ khi đang phát thì đọc lại liền mạch từ đoạn hiện tại
  useEffect(() => {
    const v = videoRef.current;
    if (!segments || !v) return undefined;
    if (voice === 'off' || v.paused) stopSpeech(); else speakFrom(i);
    return () => stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, speed, segments]);

  const pickFile = (f) => {
    if (!f || running || saving) return;
    setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 200));
    setSegments(null);
    setDone(false);
    setSaved(null);
    setSaveError('');
    setUploadedUrl('');
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setFile(f);
    setFileName(f.name);
    setObjectUrl(URL.createObjectURL(f));
    setNeedInput(false);
  };

  const jump = (n) => {
    setI(n);
    const v = videoRef.current;
    if (!v || !segments || !segments.length) return;
    jumpRef.current = n;
    if (segments[n].start != null) {
      v.currentTime = segments[n].start;
    } else {
      v.currentTime = (n / segments.length) * (v.duration || 0);
    }
  };

  // Toàn màn hình cho cả khung (video + phụ đề), vì nút toàn màn hình gốc của video sẽ làm mất phụ đề
  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      v.pause();
      stopSpeech();
    }
  };

  const toggleSub = (l) => setSubs((s) => {
    const next = { ...s };
    if (next[l]) delete next[l]; else next[l] = true;
    return next;
  });

  const runStage = (stageArr, key, status) => stageArr.map((v, n) => (n === key ? status : v));

  const start = async () => {
    if (running) return;
    // Lời thoại luôn được tự nhận diện (Whisper chạy ngay trong trình duyệt) từ video tải lên.
    setNeedInput(!file);
    if (!file) return;

    setTranslateErr('');
    setSaved(null);
    setSaveError('');
    setDone(false);
    setShowPipe(true);
    setRunning(true);
    setSttPhase('');

    const STAGE = ['dp0', 'dp1', ...(translate ? ['dp2'] : []), 'dp3', 'dp4'];
    const at = (k) => STAGE.indexOf(k);
    const sttIdx = at('dp0');
    const tIdx = at('dp2');
    const vIdx = at('dp3');
    const doneIdx = at('dp4');
    setStageKeys(STAGE);
    setStages(runStage(STAGE.map(() => 'wait'), at('dp1'), 'done')); // video đã có sẵn từ trước khi bấm Dịch

    try {
      let lines;
      let chunkTimes = null;

      {
        setStages((s) => runStage(s, sttIdx, 'run'));
        const { audio } = await fileToWhisperAudio(file);
        const output = await transcribeVideoAudio(audio, sourceLang, setSttPhase);
        const chunks = (output.chunks && output.chunks.length)
          ? output.chunks
          : [{ text: output.text || '', timestamp: [0, videoRef.current?.duration || null] }];
        // Gộp các mảnh ngắn của Whisper thành đoạn dài hơn (đồng thời bỏ mảnh rỗng) để giọng đọc liền mạch, ít khoảng ngắt
        const merged = mergeChunks(chunks, { minSentence: 40, maxLen: 180 });
        lines = merged.map((x) => x.text);
        chunkTimes = merged.map((x) => ({ start: x.start, end: x.end }));
        if (!lines.length) throw new TranslateError('empty');
        setStages((s) => runStage(s, sttIdx, 'done'));
      }

      let translated;
      if (translate) {
        setStages((s) => runStage(s, tIdx, 'run'));
        translated = await translateLines(lines, sourceLang);
        setStages((s) => runStage(s, tIdx, 'done'));
      } else {
        // Không dịch: mỗi đoạn chỉ có đúng ngôn ngữ gốc
        translated = lines.map((text) => ({ [sourceLang]: text }));
      }
      if (!translated.length) throw new TranslateError('empty');

      setStages((s) => runStage(s, vIdx, 'run'));
      if (hasSpeech && !voicesLoaded()) await new Promise((r) => setTimeout(r, 200));

      const withTime = chunkTimes
        ? translated.map((seg, n) => ({ ...seg, start: chunkTimes[n].start, end: chunkTimes[n].end }))
        : translated;

      setResultLanguage(sourceLang);
      setSegments(withTime);
      setI(0);
      const outLangs = translate ? ['vi', 'en', 'zh'] : [sourceLang];
      const wanted = translate ? lang : sourceLang;
      setVoice(firstAvailableVoice(wanted, outLangs));
      setSubs({ [wanted]: true });
      setStages((s) => runStage(s, vIdx, 'done'));
      setStages((s) => runStage(s, doneIdx, 'done'));
      setDone(true);
      if (playerRef.current) playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      let key = 'd_translate_err';
      if (e instanceof TranslateError) key = ERR_KEY[e.code] || 'd_translate_err';
      else if (e instanceof AudioExtractError) key = 'd_stt_err';
      else key = 'd_stt_err';
      setTranslateErr(key);
      setStages((s) => s.map((v) => (v === 'run' ? 'wait' : v)));
    } finally {
      setRunning(false);
      setSttPhase('');
    }
  };

  const saveProject = async () => {
    if (!user || !segments || saving || !title.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      let videoUrl = uploadedUrl;
      if (!videoUrl && file) {
        const upload = await projectApi.upload(user, file);
        videoUrl = upload.url;
        setUploadedUrl(videoUrl);
      }
      const savedSegments = segments.map((segment) => {
        const timed = Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start;
        return { ...segment, start: timed ? segment.start : null, end: timed ? segment.end : null };
      });
      const { project } = await projectApi.create(user, {
        title: title.trim(), originalLanguage: resultLanguage,
        sourceName: fileName, videoUrl, segments: savedSegments,
      });
      setSaved(project);
    } catch (error) { setSaveError(projectError(error)); }
    finally { setSaving(false); }
  };

  const segLangs = segments ? ['vi', 'en', 'zh'].filter((l) => segments[0][l] != null) : [];
  const shownSubs = segLangs.filter((l) => subs[l]);
  const voiceMissing = segments && voice !== 'off' && (!hasSpeech || (voicesLoaded() && !voiceFor(voice)));
  const avail = segments ? availableVoiceLangs() : null; // null = chưa tải xong danh sách giọng, chưa vội khoá
  const anyLocked = avail && segLangs.some((l) => !avail[l]);
  const videoSrc = objectUrl;
  const activeStages = stageKeys;
  const sttRunning = running && stages[0] === 'run';

  return (
    <>
      <div className="wrap page-head">
        <h1>{t('d_title')}</h1>
        <p>{t('d_sub')}</p>
      </div>
      <div className="wrap">
        <label
          className={'drop' + (over ? ' over' : '') + (file ? ' has-file' : '')}
          onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
          onDrop={(e) => { e.preventDefault(); setOver(false); pickFile(e.dataTransfer.files[0]); }}
        >
          <input type="file" accept="video/*" disabled={running || saving} onChange={(e) => pickFile(e.target.files[0])} />
          {file ? (
            <>
              <strong className="drop-name">{t('d_chosen')}{fileName}</strong>
              <small>{t('d_change')}</small>
            </>
          ) : (
            <strong>{t('d_drop')}</strong>
          )}
        </label>
        {needInput ? <p className="err" role="alert" style={{ marginTop: 10 }}>{t('d_need')}</p> : null}

        <div className="run-bar">
          <div className="ctl-group">
            <label htmlFor="src-lang" style={{ fontSize: '.9rem', fontWeight: 600 }}>{t('d_source_lang')}</label>
            <select id="src-lang" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <label className="ctl-group" style={{ fontSize: '.9rem', fontWeight: 600, gap: 8 }}>
            <input type="checkbox" checked={translate} onChange={(e) => setTranslate(e.target.checked)} />
            {t('d_opt_translate')}
          </label>
          <button className="btn btn-primary" type="button" onClick={start} disabled={running || saving}>
            {running ? t(translate ? 'd_translating' : 'd_dubbing') : t(translate ? 'd_translate_btn' : 'd_dub_btn')}
          </button>
        </div>
        <p className="note" style={{ marginTop: 10 }}>{t('d_auto_hint')}</p>

        {translateErr ? <p className="err" role="alert" style={{ marginTop: 16 }}>{t(translateErr)}</p> : null}

        {showPipe ? (
          <>
            <ol className="pipe">
              {activeStages.map((key, n) => (
                <li key={key} data-s={stages[n]}>
                  <span>{t(key)}</span>
                  <span className="st">{t('st_' + stages[n])}</span>
                  <div className="bar-t"><b /></div>
                </li>
              ))}
            </ol>
            {sttRunning ? (
              <p className="note" role="status" style={{ marginTop: 4 }}>
                {t(sttPhase === 'listening' ? 'd_stt_listen' : 'd_stt_model')}
              </p>
            ) : null}
          </>
        ) : null}
        {done ? <p className="ok" role="status" style={{ marginTop: 16 }}>{t(translate ? 'd_done' : 'd_done_dub')}</p> : null}

        {segments ? <section className="project-save" aria-labelledby="project-save-title">
          <h2 id="project-save-title">Lưu dự án của bạn</h2>
          <p>Video, phụ đề và kịch bản được lưu theo tài khoản để xem lại và nhận cập nhật từ quản trị viên.</p>
          {user ? <>
            <label htmlFor="project-title">Tên dự án</label>
            <input id="project-title" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving || Boolean(saved)} />
            <button type="button" className="btn btn-primary" onClick={saveProject} disabled={saving || Boolean(saved) || !title.trim()}>
              {saving ? 'Đang tải video và lưu dự án…' : saved ? 'Đã lưu dự án' : 'Lưu vào tài khoản'}
            </button>
            {saved ? <p className="ok" role="status">Đã lưu dự án #{saved.id}. <Link to="/account">Mở dự án của tôi</Link></p> : null}
            {saveError ? <p className="err" role="alert">{saveError}</p> : null}
          </> : <p><Link to="/login" state={{ from: '/demo' }}>Đăng nhập</Link> để lưu dự án. Sau khi đăng nhập, bạn cần chọn lại video nếu trang đã tải lại.</p>}
          <p className="fine">Hỗ trợ lưu MP4, WebM, MOV tối đa 100 MB. Giọng đọc đang phát từ trình duyệt; chưa xuất tệp âm thanh thuyết minh.</p>
        </section> : null}

        {segments ? (
          <div className="player" ref={playerRef}>
            <div>
              <div className="stage" ref={stageRef}>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  controlsList="nofullscreen"
                  onTimeUpdate={onTimeUpdate}
                  onPlay={onPlay}
                  onPause={stopSpeech}
                  onEnded={stopSpeech}
                  onSeeked={onSeeked}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                />
                {shownSubs.length > 0 ? (
                  <div className="subs" aria-live="polite">
                    {shownSubs.map((l) => (
                      <p className={l} lang={l === 'zh' ? 'zh-CN' : l} key={l}>
                        <b>{LANG_TAG[l]}</b>
                        <span>{segments[i][l]}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="controls">
                <div className="seg-progress">
                  {segments.map((_, n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={t('step') + ' ' + (n + 1)}
                      aria-current={n === i ? 'true' : undefined}
                      onClick={() => jump(n)}
                    />
                  ))}
                </div>
                <div className="ctl-row">
                  <button className="btn btn-primary" type="button" onClick={togglePlay}>{t('d_play')} / {t('d_pause')}</button>
                  <button className="btn" type="button" onClick={toggleFullscreen}>{t('d_fullscreen')}</button>
                  <div className="ctl-group">
                    <span>{t('d_voice')}</span>
                    <div className="chips" role="group" aria-label={t('d_voice')}>
                      {segLangs.map((l) => {
                        const locked = avail && !avail[l];
                        return (
                          <button
                            key={l}
                            type="button"
                            className="chip"
                            lang={l === 'zh' ? 'zh-CN' : l}
                            aria-pressed={voice === l}
                            disabled={locked}
                            title={locked ? t('d_novoice_chip') : undefined}
                            onClick={() => setVoice(l)}
                          >
                            {l === 'vi' ? 'Tiếng Việt' : l === 'en' ? 'English' : '中文'}{locked ? ' 🔒' : ''}
                          </button>
                        );
                      })}
                      <button type="button" className="chip" aria-pressed={voice === 'off'} onClick={() => setVoice('off')}>{t('d_off')}</button>
                    </div>
                    {anyLocked ? <p className="note">{t('d_novoice_summary')}</p> : null}
                  </div>
                </div>
                <div className="ctl-row">
                  <div className="ctl-group">
                    <span>{t('d_subs')}</span>
                    <div className="chips" role="group" aria-label={t('d_subs')}>
                      {segLangs.map((l) => (
                        <button key={l} type="button" className="chip" aria-pressed={!!subs[l]} onClick={() => toggleSub(l)}>{LANG_TAG[l]}</button>
                      ))}
                    </div>
                  </div>
                  <div className="ctl-group">
                    <label htmlFor="speed" style={{ fontSize: '.9rem', fontWeight: 600 }}>{t('d_speed')}</label>
                    <select id="speed" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}>
                      <option value={0.8}>0.8×</option>
                      <option value={1}>1×</option>
                      <option value={1.25}>1.25×</option>
                    </select>
                  </div>
                </div>
                {voice !== 'off' ? <p className="note">{t('d_mute_note')}</p> : null}
                {voiceMissing ? <p className="note">{t('d_nospeech')}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
        <div style={{ height: 84 }} />
      </div>
    </>
  );
}
