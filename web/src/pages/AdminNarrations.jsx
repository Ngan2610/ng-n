import { useState } from 'react';
import { serviceAdminApi } from '../api/services.js';
import { ServiceHeader, ServiceState, dateLabel, languageName, matchesSearch, useAdminRecords } from '../components/AdminServiceTools.jsx';

function NarrationEditor({ record, user, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(record.text);
  const [status, setStatus] = useState(record.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    try { onSaved(await serviceAdminApi.saveNarration(user, record.id, { text: text.trim(), status })); setEditing(false); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const edit = () => { setText(record.text); setStatus(record.status); setEditing(true); setError(''); setSaved(false); };
  return <article className="service-record">
    <h2>{record.title}</h2>
    <div className="service-meta"><span>{record.userEmail}</span><span>{languageName(record.language)}</span><span>{dateLabel(record.createdAt)}</span><span className="service-badge">{record.status === 'ready' ? 'Đã duyệt' : 'Bản nháp'}</span></div>
    {editing ? <form onSubmit={save}>
      <label htmlFor={`narration-${record.id}`}>Nội dung thuyết minh<textarea id={`narration-${record.id}`} required maxLength={100000} value={text} onChange={(event) => setText(event.target.value)} /></label>
      <label htmlFor={`narration-status-${record.id}`}>Trạng thái<select id={`narration-status-${record.id}`} value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Bản nháp</option><option value="ready">Đã duyệt</option></select></label>
      <div className="service-actions"><button className="btn btn-primary" disabled={saving || !text.trim()} type="submit">{saving ? 'Đang lưu…' : 'Lưu thuyết minh'}</button><button type="button" className="btn" disabled={saving} onClick={() => setEditing(false)}>Hủy</button></div>
    </form> : <><p className="service-text">{record.text}</p><button type="button" className="btn" onClick={edit}>Chỉnh sửa thuyết minh</button></>}
    {error && <p role="alert" className="service-error">{error}</p>}
    {saved && <p role="status" className="service-success">Đã lưu nội dung vào SQL Server.</p>}
  </article>;
}

export default function AdminNarrations() {
  const state = useAdminRecords(serviceAdminApi.narrations);
  const [search, setSearch] = useState('');
  const visible = state.records.filter((record) => matchesSearch(record, search));
  return <>
    <ServiceHeader title="Quản lý thuyết minh" description="Chỉnh sửa và duyệt kịch bản thuyết minh của khách hàng. Phần này lưu văn bản, chưa tạo tệp âm thanh thu sẵn." {...state} search={search} setSearch={setSearch} />
    <ServiceState {...state} empty={!visible.length} />
    {!state.loading && !state.error && <div className="service-records">{visible.map((record) => <NarrationEditor key={record.id} record={record} user={state.user} onSaved={state.replace} />)}</div>}
  </>;
}
