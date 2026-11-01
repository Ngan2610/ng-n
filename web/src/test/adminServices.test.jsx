import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminNarrations from '../pages/AdminNarrations.jsx';
import AdminSubtitles from '../pages/AdminSubtitles.jsx';
import AdminFeedback from '../pages/AdminFeedback.jsx';
import AdminVideos from '../pages/AdminVideo.jsx';

const { adminUser } = vi.hoisted(() => ({ adminUser: { email: 'admin@example.com', token: 'signed-admin-token', role: 'admin' } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: adminUser }) }));
const ok = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });
afterEach(() => vi.unstubAllGlobals());

describe('quản trị dịch vụ dùng API SQL', () => {
  it('chỉnh kịch bản thuyết minh, gửi token và hiển thị bản đã lưu', async () => {
    const record = { id: 4, projectId: 2, title: 'Bánh mì', userEmail: 'an@example.com', language: 'vi', text: 'Lời cũ', status: 'draft' };
    const fetchMock = vi.fn((url, options) => options.method === 'PATCH'
      ? ok({ narration: { ...record, ...JSON.parse(options.body) } }) : ok({ narrations: [record] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminNarrations />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa thuyết minh' }));
    await user.clear(screen.getByLabelText('Nội dung thuyết minh'));
    await user.type(screen.getByLabelText('Nội dung thuyết minh'), 'Nướng bánh vàng đều.');
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'ready');
    await user.click(screen.getByRole('button', { name: 'Lưu thuyết minh' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu nội dung');
    expect(screen.getByText('Nướng bánh vàng đều.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/api/admin/narrations/4'), expect.objectContaining({
      method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer signed-admin-token' }),
      body: JSON.stringify({ text: 'Nướng bánh vàng đều.', status: 'ready' }),
    }));
  });

  it('không lưu phụ đề có mốc thời gian đảo ngược và lưu lại khi đã sửa', async () => {
    const record = { id: 7, title: 'Món canh', userEmail: 'an@example.com', language: 'en', text: 'Add water.', start: 0, end: 2 };
    const fetchMock = vi.fn((url, options) => options.method === 'PATCH'
      ? ok({ subtitle: { ...record, ...JSON.parse(options.body) } }) : ok({ subtitles: [record] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminSubtitles />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa phụ đề' }));
    await user.clear(screen.getByLabelText('Bắt đầu (giây)'));
    await user.type(screen.getByLabelText('Bắt đầu (giây)'), '5');
    await user.click(screen.getByRole('button', { name: 'Lưu phụ đề' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('kết thúc phải lớn hơn');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.clear(screen.getByLabelText('Kết thúc (giây)'));
    await user.type(screen.getByLabelText('Kết thúc (giây)'), '8.5');
    await user.click(screen.getByRole('button', { name: 'Lưu phụ đề' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu phụ đề');
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/api/admin/subtitles/7'), expect.objectContaining({ body: JSON.stringify({ text: 'Add water.', start: 5, end: 8.5 }) }));
  });

  it('yêu cầu nội dung trả lời và lưu phản hồi vào API', async () => {
    const record = { id: 3, name: 'Khách An', email: 'an@example.com', message: 'Tôi cần sửa phụ đề.', status: 'open', reply: '' };
    const fetchMock = vi.fn((url, options) => options.method === 'PATCH'
      ? ok({ feedback: { ...record, ...JSON.parse(options.body) } }) : ok({ feedback: [record] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminFeedback />);
    const user = userEvent.setup();
    await screen.findByText('Tôi cần sửa phụ đề.');
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'replied');
    await user.click(screen.getByRole('button', { name: 'Lưu phản hồi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nhập nội dung trả lời');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.type(screen.getByLabelText('Nội dung trả lời'), 'Phụ đề đã được cập nhật.');
    await user.click(screen.getByRole('button', { name: 'Lưu phản hồi' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu phản hồi');
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/api/admin/feedback/3'), expect.objectContaining({ body: JSON.stringify({ reply: 'Phụ đề đã được cập nhật.', status: 'replied' }) }));
  });

  it('hiển thị lỗi quyền truy cập và cho phép tải lại từ máy chủ', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ code: 'forbidden' }) }).mockImplementation(() => ok({ videos: [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminVideos />);
    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền quản trị');
    await userEvent.click(screen.getByRole('button', { name: 'Làm mới danh sách' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await screen.findByText('Chưa có dữ liệu phù hợp.')).toBeInTheDocument();
    expect(localStorage.getItem('dubchef-users')).toBeNull();
  });
});
