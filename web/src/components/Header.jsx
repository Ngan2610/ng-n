import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdmin } from '../api/client.js';
import { LANGS } from '../shared/i18n.js';

const LINKS = [
  ['/features', 'nav_features'],
  ['/demo', 'nav_demo'],
  ['/pricing', 'nav_pricing'],
  ['/about', 'nav_about'],
  ['/contact', 'nav_contact'],
];
const LANG_LABEL = { vi: 'VI', en: 'EN', zh: '中文' };

export default function Header() {
  const { t, L, setL } = useI18n();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link className="brand" to="/" aria-label="Dubchef">
          <span className="mark" aria-hidden="true"><i /><i /><i /></span>
          Dubchef
        </Link>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="nav"
          aria-label={t('menu')}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
        </button>
        <nav id="nav" className={'nav' + (open ? ' open' : '')} aria-label={t('navlabel')}>
          {LINKS.map(([to, key]) => (
            <NavLink key={to} to={to}>{t(key)}</NavLink>
          ))}
          {user ? <NavLink to="/account">Dự án của tôi</NavLink> : null}
          {isAdmin(user) ? <NavLink to="/admin">{t('nav_admin')}</NavLink> : null}
          <div className="nav-end">
            <div className="lang" role="group" aria-label={t('langlabel')}>
              {LANGS.map((code, n) => (
                <button
                  key={code}
                  type="button"
                  lang={code === 'zh' ? 'zh-CN' : code}
                  aria-pressed={n === L}
                  onClick={() => setL(n)}
                >
                  {LANG_LABEL[code]}
                </button>
              ))}
            </div>
            {user ? (
              <>
                <span className="user">{t('hello')}, {user.name}</span>
                <button type="button" className="btn btn-sm" onClick={logout}>{t('logout')}</button>
              </>
            ) : (
              <>
                <Link className="btn btn-sm" to="/login">{t('nav_login')}</Link>
                <Link className="btn btn-sm btn-primary" to="/register">{t('nav_register')}</Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
