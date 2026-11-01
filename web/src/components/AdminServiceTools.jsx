import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminServices.css';

export const languageName = (language) => ({ vi: 'Tiếng Việt', en: 'English', zh: '中文' })[language] || language;
export const dateLabel = (date) => date ? new Date(date).toLocaleString('vi-VN') : '—';

export function useAdminRecords(load) {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRecords(await load(user)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [load, user]);
  useEffect(() => { reload(); }, [reload]);
  const replace = (record) => setRecords((old) => old.map((item) => item.id === record.id ? record : item));
  return { user, records, loading, error, reload, replace };
}

export function ServiceHeader({ title, description, loading, reload, search, setSearch }) {
  return <>
    <div className="adm-head"><div><h1>{title}</h1><p>{description}</p></div></div>
    <div className="service-toolbar">
      <label>Tìm kiếm<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, email hoặc nội dung" /></label>
      <button type="button" className="btn" disabled={loading} onClick={reload}>Làm mới danh sách</button>
    </div>
  </>;
}

export function ServiceState({ loading, error, empty }) {
  if (loading) return <p role="status">Đang tải dữ liệu…</p>;
  if (error) return <p className="service-error" role="alert">{error}</p>;
  if (empty) return <p className="service-empty">Chưa có dữ liệu phù hợp.</p>;
  return null;
}

export function matchesSearch(record, search) {
  const needle = search.trim().toLocaleLowerCase('vi');
  return !needle || [record.title, record.userEmail, record.language, record.text, record.name, record.email, record.message, record.reply]
    .some((value) => String(value || '').toLocaleLowerCase('vi').includes(needle));
}
