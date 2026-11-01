import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { I18nProvider } from '../context/I18nContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

/** Hiển thị toàn bộ ứng dụng (kèm menu, chân trang) tại một địa chỉ cho trước. */
export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}
