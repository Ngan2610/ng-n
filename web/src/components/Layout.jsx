import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import { trackVisit } from '../api/analytics.js';
import { useI18n } from '../context/I18nContext.jsx';

export default function Layout() {
  const { t, L } = useI18n();
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Mỗi lần đổi trang: cuộn lên đầu và đưa tiêu điểm vào nội dung (hỗ trợ đọc màn hình)
  useEffect(() => {
    window.scrollTo(0, 0);
    if (mainRef.current) mainRef.current.focus({ preventScroll: true });
  }, [pathname]);

  // Ghi một lượt xem cho trang Admin mỗi lần mở trang mới (không ghi lại khi chỉ đổi ngôn ngữ).
  const lang = ['vi', 'en', 'zh'][L];
  const langRef = useRef(lang);
  langRef.current = lang;
  useEffect(() => {
    trackVisit(pathname, langRef.current);
  }, [pathname]);

  const skip = (e) => {
    e.preventDefault();
    if (mainRef.current) mainRef.current.focus();
  };

  return (
    <>
      <a className="skip" href="#main" onClick={skip}>{t('skip')}</a>
      <Header />
      <main id="main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
