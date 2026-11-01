import { useEffect } from 'react';
import { useI18n } from '../context/I18nContext.jsx';

/** Đặt tiêu đề tab theo khóa dịch, tự đổi khi đổi ngôn ngữ. */
export function usePageTitle(key) {
  const { t } = useI18n();
  const title = t(key);
  useEffect(() => {
    document.title = title + ' | Dubchef';
  }, [title]);
}
