import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from './utils.jsx';

const ROUTES = ['/', '/features', '/demo', '/pricing', '/about', '/faq', '/contact', '/login', '/register', '/terms', '/privacy', '/admin', '/admin/users', '/khong-co'];
const LANGS = ['vi', 'en', 'zh'];

describe('Mọi trang', () => {
  it.each(ROUTES)('%s có đúng một tiêu đề h1 và vùng nội dung chính', (route) => {
    renderApp(route);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it.each(LANGS)('không lộ khóa dịch chưa có nội dung (ngôn ngữ %s)', (lang) => {
    localStorage.setItem('dubchef-lang', lang);
    for (const route of ROUTES) {
      const { container, unmount } = renderApp(route);
      const leaked = container.textContent.match(/\b[a-z]{1,4}_[a-z0-9_]+\b/g);
      expect(leaked, `${route} (${lang}) còn khóa: ${leaked}`).toBeNull();
      unmount();
    }
  });
});
