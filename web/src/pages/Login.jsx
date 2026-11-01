import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import { errorKey, SHARED } from '../api/client.js';
import Field from '../components/Field.jsx';
import { returnTarget } from '../utils/returnTo.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const back = returnTarget(state);
  usePageTitle('li_title');
  const [v, setV] = useState({ email: '', pass: '' });
  const [errs, setErrs] = useState({});
  const [srvErr, setSrvErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!EMAIL.test(v.email.trim())) er.email = 'e_email';
    if (v.pass.length < 8) er.pass = 'e_pass';
    setErrs(er);
    setSrvErr('');
    const bad = Object.keys(er);
    if (bad.length) {
      const el = document.getElementById('l-' + bad[0]);
      if (el) el.focus();
      return;
    }
    setBusy(true);
    try {
      await login({ email: v.email, password: v.pass });
      if (back) navigate(back.to, { replace: true, state: back.state });
      else navigate('/');
    } catch (x) {
      setSrvErr(errorKey(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap auth">
      <h1>{t('li_title')}</h1>
      <p className="sub">{t('li_sub')}</p>
      {back ? <p className="auth-note" role="status">{t('co_resume')}</p> : null}
      <form onSubmit={submit} noValidate>
        {srvErr ? <p className="err" role="alert" style={{ marginBottom: 16 }}>{t(srvErr)}</p> : null}
        <Field id="l-email" label={t('f_email')} error={errs.email && t(errs.email)}>
          <input id="l-email" type="email" autoComplete="email" value={v.email} onChange={set('email')} aria-invalid={errs.email ? 'true' : undefined} />
        </Field>
        <Field id="l-pass" label={t('f_pass')} error={errs.pass && t(errs.pass)}>
          <input id="l-pass" type="password" autoComplete="current-password" value={v.pass} onChange={set('pass')} aria-invalid={errs.pass ? 'true' : undefined} />
        </Field>
        <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={busy}>{t('nav_login')}</button>
      </form>
      <p className="alt">{t('li_no')} <Link to="/register" state={state}>{t('rg_title')}</Link></p>
      {!SHARED ? <p className="auth-note">{t('auth_demo')}</p> : null}
    </div>
  );
}
