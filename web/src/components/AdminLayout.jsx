import { Link, NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdmin } from '../api/client.js';
import { LANGS } from '../shared/i18n.js';

const LANG_LABEL = { vi: 'VI', en: 'EN', zh: '中文' };

/** Khung trang quản trị: thanh bên + thanh trên. Chưa đăng nhập hoặc không phải admin thì không vào được. */
export default function AdminLayout() {
  const { t, L, setL } = useI18n();
  const { user, logout, loading, authError, retrySession } = useAuth();

  if (loading) return <main id="main" className="adm-gate"><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>;
  if (authError) return <main id="main" className="adm-gate"><div className="adm-card"><p role="alert">Không thể kiểm tra phiên đăng nhập với máy chủ.</p><button type="button" className="btn" onClick={retrySession}>Thử lại</button></div></main>;

  if (!isAdmin(user)) {
    return (
      <main id="main" className="adm-gate">
        <div className="adm-card">
          <h1>{t('ad_brand')}</h1>
          <p role="alert">{t(user ? 'ad_denied' : 'ad_need_login')}</p>
          <p className="fine">Đăng nhập bằng tài khoản được cấp quyền quản trị.</p>
          <p style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {user ? null : <Link className="btn btn-primary" to="/login">{t('nav_login')}</Link>}
            <Link className="btn" to="/">{t('ad_back')}</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="adm">
      <aside className="adm-side">
        <Link className="brand" to="/admin" aria-label={t('ad_brand')}>
          <span className="mark" aria-hidden="true"><i /><i /><i /></span>
          Dubchef
        </Link>
        <p className="adm-tag">{t('ad_brand')}</p>
        <nav aria-label={t('ad_menu')} className="adm-nav">
          <NavLink to="/admin" end>{t('ad_nav_overview')}</NavLink>
          <NavLink to="/admin/users">{t('ad_nav_users')}</NavLink>
          <NavLink to="/admin/videos">
            Quản lý video
          </NavLink>
          <NavLink to="/admin/narrations">Thuyết minh</NavLink>
          <NavLink to="/admin/subtitles">Phụ đề</NavLink>
          <NavLink to="/admin/feedback">Phản hồi</NavLink>
          <NavLink to="/admin/languages">
            Quản lý ngôn ngữ
          </NavLink>
          <NavLink to="/admin/qr">{t('ad_nav_qr')}</NavLink>
        </nav>
        <Link className="adm-back" to="/">← {t('ad_back')}</Link>
      </aside>
      <div className="adm-main">
        <header className="adm-top">
          <div className="lang" role="group" aria-label={t('langlabel')}>
            {LANGS.map((code, n) => (
              <button key={code} type="button" lang={code === 'zh' ? 'zh-CN' : code} aria-pressed={n === L} onClick={() => setL(n)}>
                {LANG_LABEL[code]}
              </button>
            ))}
          </div>
          <span className="user">{user.name}</span>
          <button type="button" className="btn btn-sm" onClick={logout}>{t('logout')}</button>
        </header>
        <main id="main" tabIndex={-1} className="adm-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
