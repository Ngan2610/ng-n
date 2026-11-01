import { useEffect, useState } from 'react';
import { serviceAdminApi } from '../api/services.js';
import { ServiceHeader, ServiceState, dateLabel, matchesSearch, useAdminRecords } from '../components/AdminServiceTools.jsx';

const STATUS_LABELS = { open: 'Chờ xử lý', replied: 'Đã phản hồi', closed: 'Đã đóng' };

function FeedbackEditor({ record, user, onSaved }) {
  const [reply, setReply] = useState(record.reply || '');
  const [status, setStatus] = useState(record.status || 'open');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setReply(record.reply || '');
    setStatus(record.status || 'open');
  }, [record.reply, record.status]);
  const save = async (event) => {
    event.preventDefault();
    if (status === 'replied' && !reply.trim()) { setError('Vui lòng nhập nội dung trả lời trước khi đánh dấu đã phản hồi.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try { onSaved(await serviceAdminApi.saveFeedback(user, record.id, { reply: reply.trim(), status })); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  return <article className="service-record">
    <h2>{record.name}</h2>
    <div className="service-meta"><span>{record.email}</span><span>{dateLabel(record.createdAt)}</span><span className="service-badge">{STATUS_LABELS[record.status] || STATUS_LABELS.open}</span></div>
    <p className="service-text">{record.message}</p>
    <form onSubmit={save}>
      <label htmlFor={`reply-${record.id}`}>Nội dung trả lời<textarea id={`reply-${record.id}`} maxLength={2000} value={reply} onChange={(event) => { setReply(event.target.value); setSaved(false); }} /></label>
      <label htmlFor={`feedback-status-${record.id}`}>Trạng thái<select id={`feedback-status-${record.id}`} value={status} onChange={(event) => { setStatus(event.target.value); setSaved(false); }}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <p className="fine">Khách hàng đăng nhập bằng email này có thể xem câu trả lời trong trang tài khoản. Hệ thống không tự gửi email.</p>
      <div className="service-actions"><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Đang lưu…' : 'Lưu phản hồi'}</button>{record.repliedAt && <span className="fine">Lần trả lời gần nhất: {dateLabel(record.repliedAt)}</span>}</div>
    </form>
    {error && <p role="alert" className="service-error">{error}</p>}
    {saved && <p role="status" className="service-success">Đã lưu phản hồi vào SQL Server.</p>}
  </article>;
}

export default function AdminFeedback() {
  const state = useAdminRecords(serviceAdminApi.feedback);
  const [search, setSearch] = useState('');
  const visible = state.records.filter((record) => matchesSearch(record, search));
  return <>
    <ServiceHeader title="Quản lý phản hồi" description="Tiếp nhận liên hệ, trả lời khách hàng và theo dõi trạng thái xử lý." {...state} search={search} setSearch={setSearch} />
    <ServiceState {...state} empty={!visible.length} />
    {!state.loading && !state.error && <div className="service-records">{visible.map((record) => <FeedbackEditor key={record.id} record={record} user={state.user} onSaved={state.replace} />)}</div>}
  </>;
}
