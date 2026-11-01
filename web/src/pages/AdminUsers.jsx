import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import { adminApi } from '../api/admin.js';

const PAGE = 8;
const LOCALES = ['vi-VN', 'en-US', 'zh-CN'];

const fmtDate = (L, iso) => (iso ? new Date(iso).toLocaleDateString(LOCALES[L]) : '–');

/** Tìm theo tên/email (không phân biệt hoa thường) rồi sắp xếp. Hàm thuần, dễ kiểm thử. */
export function filterUsers(users, query, sort) {
  const q = query.trim().toLowerCase();
  const list = users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  return list.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : (b.at || '').localeCompare(a.at || '')));
}

/** Tạo nội dung CSV (có dấu ngoặc kép để tên chứa dấu phẩy vẫn đúng). */
export function toCsv(users) {
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  return ['name,email,registered,status', ...users.map((u) => [u.name, u.email, u.at || '', u.status].map(q).join(','))].join('\n');
}

function initials(name) {
  return name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
}

export default function AdminUsers() {
  const { t, L } = useI18n();
  const { user } = useAuth();
  usePageTitle('ad_users_title');
  const [users, setUsers] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(0);
  const [asking, setAsking] = useState(null); // email đang chờ xác nhận xóa

  const load = useCallback(() => {
    setFailed(false);
    adminApi.users(user).then(setUsers).catch(() => setFailed(true));
  }, [user]);
  useEffect(load, [load]);

  const rows = useMemo(() => filterUsers(users || [], query, sort), [users, query, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  const act = (fn) => fn().then(load).catch(() => setFailed(true));
  const toggle = (u) => act(() => adminApi.setStatus(user, u.email, u.status === 'locked' ? 'active' : 'locked'));
  const remove = (u) => { setAsking(null); return act(() => adminApi.remove(user, u.email)); };

  function exportCsv() {
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dubchef-users.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = (users || []).length;
  const locked = (users || []).filter((u) => u.status === 'locked').length;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{t('ad_users_title')}</h1>
          <p>{t('ad_users_sub')}</p>
        </div>
        <div className="adm-tools">
          <button type="button" className="btn btn-sm" onClick={load}>{t('ad_refresh')}</button>
          <button type="button" className="btn btn-sm" onClick={exportCsv} disabled={!rows.length}>{t('ad_export')}</button>
        </div>
      </div>

      {failed ? <p role="alert">{t('ad_fail')}</p> : null}
      {!users && !failed ? <p role="status">{t('ad_loading')}</p> : null}

      {users ? (
        <>
          <div className="kpis kpis-3">
            <Stat label={t('ad_users_total')} value={total} id="us-total" />
            <Stat label={t('ad_active')} value={total - locked} id="us-active" />
            <Stat label={t('ad_locked')} value={locked} id="us-locked" />
          </div>

          <section className="panel" aria-label={t('ad_users_title')}>
            <div className="filters">
              <input
                type="search"
                aria-label={t('ad_search')}
                placeholder={t('ad_search')}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              />
              <label>
                <span className="sr-only">{t('ad_sort')}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('ad_sort')}>
                  <option value="new">{t('ad_sort_new')}</option>
                  <option value="name">{t('ad_sort_name')}</option>
                </select>
              </label>
            </div>

            {shown.length ? (
              <div className="tbl-wrap">
                <table className="utable">
                  <thead>
                    <tr>
                      <th scope="col">{t('ad_name')}</th>
                      <th scope="col">{t('ad_email')}</th>
                      <th scope="col">{t('ad_joined')}</th>
                      <th scope="col">{t('ad_status')}</th>
                      <th scope="col">{t('ad_action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((u) => (
                      <tr key={u.email}>
                        <th scope="row"><span className="av" aria-hidden="true">{initials(u.name)}</span>{u.name}</th>
                        <td>{u.email}</td>
                        <td>{fmtDate(L, u.at)}</td>
                        <td><span className={'chip ' + u.status}>{t(u.status === 'locked' ? 'ad_locked' : 'ad_active')}</span></td>
                        <td>
                          {asking === u.email ? (
                            <span className="ask" role="group" aria-label={t('ad_confirm_del')}>
                              {t('ad_confirm_del')}
                              <button type="button" className="btn btn-sm danger" onClick={() => remove(u)}>{t('ad_delete')}</button>
                              <button type="button" className="btn btn-sm" onClick={() => setAsking(null)}>{t('ad_cancel')}</button>
                            </span>
                          ) : (
                            <span className="acts">
                              <button type="button" className="btn btn-sm" onClick={() => toggle(u)}>
                                {u.status === 'locked' ? t('ad_unlock') : t('ad_lock')}
                                <span className="sr-only"> – {u.name}</span>
                              </button>
                              <button type="button" className="btn btn-sm danger" onClick={() => setAsking(u.email)}>
                                {t('ad_delete')}
                                <span className="sr-only"> – {u.name}</span>
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="fine" style={{ margin: 16 }}>{t('ad_no_match')}</p>
            )}

            {rows.length > PAGE ? (
              <div className="pager">
                <span aria-live="polite">{cur * PAGE + 1}–{Math.min(rows.length, cur * PAGE + PAGE)} / {rows.length}</span>
                <button type="button" className="btn btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>{t('ad_prev')}</button>
                <button type="button" className="btn btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>{t('ad_next')}</button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}

function Stat({ label, value, id }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-num" data-testid={id}>{value}</p>
    </div>
  );
}
