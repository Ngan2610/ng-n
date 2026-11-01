import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../utils/usePageTitle.js';
import { errorKey, SHARED } from '../api/client.js';
import Field from '../components/Field.jsx';
import { returnTarget } from '../utils/returnTo.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { t } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const back = returnTarget(state);
  usePageTitle('rg_title');
  const [v, setV] = useState({ name: '', email: '', pass: '', pass2: '', agree: false });
  const [errs, setErrs] = useState({});
  const [srvErr, setSrvErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!v.name.trim()) er.name = 'e_name';
    if (!EMAIL.test(v.email.trim())) er.email = 'e_email';
    if (v.pass.length < 8) er.pass = 'e_pass';
    if (!v.pass2 || v.pass2 !== v.pass) er.pass2 = 'e_pass2';
    if (!v.agree) er.agree = 'e_agree';
    setErrs(er);
    setSrvErr('');
    const bad = Object.keys(er);
    if (bad.length) {
      const el = document.getElementById('r-' + bad[0]);
      if (el) el.focus();
      return;
    }
    setBusy(true);
    try {
      await register({ name: v.name, email: v.email, password: v.pass });
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
      <h1>{t('rg_title')}</h1>
      <p className="sub">{t('rg_sub')}</p>
      <form onSubmit={submit} noValidate>
        {srvErr ? <p className="err" role="alert" style={{ marginBottom: 16 }}>{t(srvErr)}</p> : null}
        <Field id="r-name" label={t('f_name')} error={errs.name && t(errs.name)}>
          <input id="r-name" autoComplete="name" value={v.name} onChange={set('name')} aria-invalid={errs.name ? 'true' : undefined} />
        </Field>
        <Field id="r-email" label={t('f_email')} error={errs.email && t(errs.email)}>
          <input id="r-email" type="email" autoComplete="email" value={v.email} onChange={set('email')} aria-invalid={errs.email ? 'true' : undefined} />
        </Field>
        <Field id="r-pass" label={t('f_pass')} error={errs.pass && t(errs.pass)}>
          <input id="r-pass" type="password" autoComplete="new-password" value={v.pass} onChange={set('pass')} aria-invalid={errs.pass ? 'true' : undefined} />
        </Field>
        <Field id="r-pass2" label={t('f_pass2')} error={errs.pass2 && t(errs.pass2)}>
          <input id="r-pass2" type="password" autoComplete="new-password" value={v.pass2} onChange={set('pass2')} aria-invalid={errs.pass2 ? 'true' : undefined} />
        </Field>
        <div className="field">
          <div className="check">
            <input id="r-agree" type="checkbox" checked={v.agree} onChange={(e) => setV((s) => ({ ...s, agree: e.target.checked }))} aria-invalid={errs.agree ? 'true' : undefined} />
            <label htmlFor="r-agree">{t('f_agree')} <Link to="/terms">{t('tm_title')}</Link></label>
          </div>
          {errs.agree ? <p className="err" role="alert">{t(errs.agree)}</p> : null}
        </div>
        <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={busy}>{t('rg_btn')}</button>
      </form>
      <p className="alt">{t('rg_have')} <Link to="/login" state={state}>{t('nav_login')}</Link></p>
      {!SHARED ? <p className="auth-note">{t('auth_demo')}</p> : null}
    </div>
  );
}
