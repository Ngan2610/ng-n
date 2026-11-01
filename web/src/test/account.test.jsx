import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils.jsx';
import { CUSTOMER, installMockBackend, saveSession } from './mockBackend.js';
import { projectApi } from '../api/projectApi.js';
import { toSrt } from '../utils/subtitles.js';
import * as subtitles from '../utils/subtitles.js';

const project = {
  id: 4, title: 'Món canh', originalLanguage: 'vi', sourceName: 'canh.mp4', videoUrl: '',
  segments: [{ vi: 'Bản cũ', en: 'Old caption', start: 0, end: 2 }],
  subtitles: [{ index: 0, language: 'vi', text: 'Nội dung admin đã sửa', start: 3, end: 6 }],
  narrations: [{ language: 'vi', text: 'Kịch bản đã duyệt', status: 'ready' }],
};
let backend;
beforeEach(() => { backend = installMockBackend({ users: [CUSTOMER] }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Dự án và phản hồi theo tài khoản', () => {
  it('khách phải đăng nhập; không lấy dữ liệu dự án', async () => {
    const list = vi.spyOn(projectApi, 'list');
    renderApp('/account');
    expect(await screen.findByText('Đăng nhập để xem dự án và phản hồi được lưu theo tài khoản.')).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it('xác thực phiên rồi mở phụ đề với nội dung và thời gian admin đã sửa', async () => {
    saveSession();
    vi.spyOn(projectApi, 'list').mockResolvedValue({ projects: [project] });
    vi.spyOn(projectApi, 'messages').mockResolvedValue({ messages: [{ id: 3, message: 'Xin sửa giúp', reply: 'Đã cập nhật phụ đề', status: 'replied' }] });
    const download = vi.spyOn(subtitles, 'downloadSrt').mockReturnValue(true);
    const user = userEvent.setup();
    renderApp('/account');
    await user.click(await screen.findByRole('button', { name: 'Mở dự án #4' }));
    expect(screen.getByText('Nội dung admin đã sửa')).toBeInTheDocument();
    expect(screen.getByText('3.00 – 6.00 giây')).toBeInTheDocument();
    expect(screen.getByText('Đã cập nhật phụ đề')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tải phụ đề SRT' }));
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ segments: [{ vi: 'Nội dung admin đã sửa', start: 3, end: 6 }] }), 'vi');
  });

  it('phiên hết hạn bị xóa, còn lỗi mạng không xóa phiên', async () => {
    saveSession({ ...CUSTOMER, token: 'expired' });
    renderApp('/account');
    expect(await screen.findByText('Đăng nhập để xem dự án và phản hồi được lưu theo tài khoản.')).toBeInTheDocument();
    expect(localStorage.getItem('dubchef-session')).toBeNull();
  });

  it('gửi phản hồi đã đăng nhập bằng API và hiển thị thành công sau máy chủ', async () => {
    saveSession();
    vi.spyOn(projectApi, 'list').mockResolvedValue({ projects: [] });
    vi.spyOn(projectApi, 'messages').mockResolvedValue({ messages: [] });
    const user = userEvent.setup();
    renderApp('/account');
    await user.type(await screen.findByLabelText('Gửi phản hồi cho quản trị viên'), 'Xin kiểm tra phụ đề giúp tôi');
    await user.click(screen.getByRole('button', { name: 'Gửi phản hồi' }));
    expect(await screen.findByText('Đã gửi phản hồi. Câu trả lời sẽ xuất hiện tại đây.')).toBeInTheDocument();
    const call = backend.calls.find((item) => item.path === '/api/contact');
    expect(call.headers.get('Authorization')).toBe('Bearer customer-token');
    expect(backend.messages[0].message).toBe('Xin kiểm tra phụ đề giúp tôi');
  });

  it('lỗi máy chủ có thể thử lại và không hiển thị thành công giả', async () => {
    saveSession();
    const list = vi.spyOn(projectApi, 'list').mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ projects: [project] });
    vi.spyOn(projectApi, 'messages').mockResolvedValue({ messages: [] });
    const user = userEvent.setup();
    renderApp('/account');
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối');
    await user.click(screen.getByRole('button', { name: 'Làm mới dữ liệu' }));
    expect(await screen.findByRole('button', { name: 'Mở dự án #4' })).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});

describe('Xuất phụ đề SRT', () => {
  it('giữ đúng ngôn ngữ và thời gian, bỏ đoạn thiếu mốc thay vì tự bịa', () => {
    const result = toSrt([
      { vi: 'Chào bạn', start: 1.25, end: 3.5 },
      { vi: 'Không có mốc', start: null, end: null },
      { en: 'Only English', start: 4, end: 6 },
      { vi: 'Sai thứ tự', start: 10, end: 9 },
    ], 'vi');
    expect(result).toBe('1\n00:00:01,250 --> 00:00:03,500\nChào bạn\n');
  });
});
