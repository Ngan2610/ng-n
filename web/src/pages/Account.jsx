import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { projectApi, projectError } from '../api/projectApi.js';
import { downloadSrt, toSrt } from '../utils/subtitles.js';
import { hasSpeech, speakQueue, stopSpeech, voiceFor } from '../utils/speech.js';
import './Account.css';

const LANGUAGES = { vi: 'Tiếng Việt', en: 'English', zh: '中文' };
const messageState = { open: 'Chờ phản hồi', replied: 'Đã phản hồi', closed: 'Đã đóng' };
const dateText = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

function SavedProject({ project, user }) {
  const [media, setMedia] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [language, setLanguage] = useState(project.originalLanguage || 'vi');
  const [position, setPosition] = useState(0);
  const [speechError, setSpeechError] = useState('');
  const rawSegments = project.segments || [];
  const languageSubtitles = project.subtitles?.filter((item) => item.language === language).sort((a, b) => a.index - b.index);
  const segments = languageSubtitles?.length ? languageSubtitles.map((item) => ({ [language]: item.text, start: item.start, end: item.end })) : rawSegments;
  const languages = Object.keys(LANGUAGES).filter((code) => project.subtitles?.some((item) => item.language === code) || rawSegments.some((segment) => segment[code]));
  const current = segments.find((segment) => Number.isFinite(segment.start) && segment.start <= position && segment.end > position);
  const narration = project.narrations?.find((item) => item.language === language);

  useEffect(() => {
    setMedia('');
    setMediaError('');
    setPosition(0);
    if (!project.videoUrl) return undefined;
    const controller = new AbortController();
    let url;
    setMediaLoading(true);
    projectApi.media(user, project.videoUrl, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setMedia(url);
    }).catch((error) => {
      if (error.name !== 'AbortError') setMediaError(projectError(error));
    }).finally(() => { if (!controller.signal.aborted) setMediaLoading(false); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); stopSpeech(); };
  }, [project.videoUrl, user]);

  const listen = () => {
    const voice = voiceFor(language);
    if (!hasSpeech || !voice) { setSpeechError('Trình duyệt chưa có giọng đọc cho ngôn ngữ này. Bạn vẫn có thể xem và tải phụ đề.'); return; }
    setSpeechError('');
    const text = narration?.text || segments.map((segment) => segment[language] || '').join(' ');
    speakQueue([{ text, rate: 1 }], { lang: language, voice });
  };

  return (
    <section className="account-card" aria-labelledby="saved-project-title">
      <h2 id="saved-project-title">{project.title}</h2>
      <p className="fine">{project.sourceName} · {dateText(project.createdAt)}</p>
      {mediaLoading ? <p role="status">Đang tải video…</p> : null}
      {mediaError ? <p className="err" role="alert">{mediaError}</p> : null}
      {media ? <div className="account-player">
        <video src={media} controls onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)} />
        {current?.[language] ? <p className="account-caption">{current[language]}</p> : null}
      </div> : null}
      {!project.videoUrl ? <p className="note">Dự án này chỉ có nội dung văn bản, chưa có video lưu trên máy chủ.</p> : null}
      <div className="account-actions">
        <label htmlFor="account-language">Ngôn ngữ phụ đề</label>
        <select id="account-language" value={language} onChange={(event) => { stopSpeech(); setLanguage(event.target.value); }}>
          {languages.map((code) => <option key={code} value={code}>{LANGUAGES[code]}</option>)}
        </select>
        <button className="btn" type="button" disabled={!toSrt(segments, language)} onClick={() => downloadSrt({ ...project, segments }, language)}>Tải phụ đề SRT</button>
        <button className="btn" type="button" onClick={listen}>Nghe kịch bản</button>
        <button className="btn" type="button" onClick={stopSpeech}>Dừng đọc</button>
      </div>
      <p className="note">Giọng đọc sử dụng trình duyệt. Tệp âm thanh thuyết minh chưa được tạo hoặc xuất từ máy chủ.</p>
      {speechError ? <p role="status">{speechError}</p> : null}
      {narration ? <details><summary>Kịch bản thuyết minh đã lưu</summary><p className="account-script">{narration.text}</p></details> : null}
      {!toSrt(segments, language) ? <p className="note">Chưa có mốc thời gian hợp lệ để xuất SRT cho ngôn ngữ này.</p> : null}
      <ol className="account-transcript" aria-label="Phụ đề đã lưu">
        {segments.map((segment, index) => <li key={index}>
          <span className="fine">{Number.isFinite(segment.start) ? `${segment.start.toFixed(2)} – ${Number.isFinite(segment.end) ? segment.end.toFixed(2) : '?'} giây` : 'Chưa có mốc thời gian'}</span>
          <p>{segment[language] || '—'}</p>
        </li>)}
      </ol>
    </section>
  );
}

export default function Account() {
  const { user, loading: authLoading, authError, retrySession } = useAuth();
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    if (!user) return undefined;
    let live = true;
    setLoading(true);
    setError('');
    Promise.all([projectApi.list(user), projectApi.messages(user)]).then(([data, inbox]) => {
      if (!live) return;
      setProjects(data.projects || []);
      setMessages(inbox.messages || []);
      setSelected((current) => current ? data.projects.find((item) => item.id === current.id) || null : null);
    }).catch((reason) => { if (live) setError(projectError(reason)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user, refresh]);

  const send = async (event) => {
    event.preventDefault();
    setSending(true); setSent(false); setSendError('');
    try {
      await api.contact({ name: user.name, email: user.email, message: message.trim() });
      setMessage(''); setSent(true); reload();
    } catch (reason) { setSendError(projectError(reason)); }
    finally { setSending(false); }
  };

  if (authLoading) return <div className="wrap page-head"><p role="status">Đang xác thực tài khoản…</p></div>;
  if (authError) return <div className="wrap page-head"><p role="alert">Chưa thể xác thực phiên đăng nhập. Kiểm tra kết nối và thử lại.</p><button className="btn" onClick={retrySession}>Thử lại</button></div>;
  if (!user) return <div className="wrap page-head"><h1>Dự án của tôi</h1><p>Đăng nhập để xem dự án và phản hồi được lưu theo tài khoản.</p><Link className="btn btn-primary" to="/login" state={{ from: '/account' }}>Đăng nhập</Link></div>;

  return <div className="wrap account-page">
    <div className="page-head"><h1>Dự án của tôi</h1><p>{user.name} · {user.email}</p></div>
    <div className="account-actions"><Link className="btn btn-primary" to="/demo">Tạo dự án từ video</Link><button className="btn" type="button" onClick={reload} disabled={loading}>Làm mới dữ liệu</button></div>
    {loading ? <p role="status">Đang tải dữ liệu…</p> : null}
    {error ? <p className="err" role="alert">{error}</p> : null}
    {!loading && !error && !projects.length ? <p className="account-card">Chưa có dự án. Xử lý video ở trang Trải nghiệm rồi bấm “Lưu vào tài khoản”.</p> : null}
    <div className="account-projects">
      {projects.map((project) => <article className="account-card" key={project.id}>
        <h2>{project.title}</h2><p className="fine">{project.sourceName} · {dateText(project.createdAt)}</p>
        <p>{project.segments?.length || 0} đoạn phụ đề · {LANGUAGES[project.originalLanguage] || project.originalLanguage}</p>
        <button className="btn" type="button" onClick={() => setSelected(project)}>Mở dự án #{project.id}</button>
      </article>)}
    </div>
    {selected ? <SavedProject key={selected.id} project={selected} user={user} /> : null}
    <section className="account-card" aria-labelledby="my-feedback"><h2 id="my-feedback">Hỗ trợ và phản hồi</h2>
      <form onSubmit={send}>
        <label htmlFor="account-message">Gửi phản hồi cho quản trị viên</label>
        <textarea id="account-message" maxLength={2000} required value={message} onChange={(event) => setMessage(event.target.value)} />
        <button className="btn btn-primary" disabled={sending || !message.trim()}>{sending ? 'Đang gửi…' : 'Gửi phản hồi'}</button>
      </form>
      {sent ? <p className="ok" role="status">Đã gửi phản hồi. Câu trả lời sẽ xuất hiện tại đây.</p> : null}
      {sendError ? <p className="err" role="alert">{sendError}</p> : null}
      {!messages.length && !loading && !error ? <p>Chưa có phản hồi.</p> : null}
      <div className="account-messages">{messages.map((item) => <article key={item.id}>
        <p className="fine">{dateText(item.createdAt)} · {messageState[item.status] || 'Chờ phản hồi'}</p>
        <p className="account-script">{item.message}</p>
        {item.reply ? <div className="account-reply"><strong>Quản trị viên trả lời</strong><p className="account-script">{item.reply}</p><small>{dateText(item.repliedAt)}</small></div> : null}
      </article>)}</div>
    </section>
  </div>;
}
