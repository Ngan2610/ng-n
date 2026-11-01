import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectApi } from './projectApi.js';

const user = { token: 'customer-token' };
afterEach(() => vi.unstubAllGlobals());

describe('API dự án', () => {
  it('tải đúng video thô có bearer và tên tệp mã hóa', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ url: '/api/media/uuid.mp4' }) });
    vi.stubGlobal('fetch', fetch);
    const file = new File(['video'], 'món ăn.mp4', { type: 'video/mp4' });
    expect(await projectApi.upload(user, file)).toEqual({ url: '/api/media/uuid.mp4' });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/uploads$/), expect.objectContaining({
      method: 'POST', body: file, headers: { 'Content-Type': 'video/mp4', 'X-File-Name': encodeURIComponent(file.name), Authorization: 'Bearer customer-token' },
    }));
  });

  it('không tải loại tệp ngoài danh sách và không nhận nội dung lưu giả khi API lỗi', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(projectApi.upload(user, new File(['text'], 'a.html', { type: 'text/html' }))).rejects.toMatchObject({ code: 'video_type' });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({ code: 'server' }) });
    await expect(projectApi.create(user, { title: 'A' })).rejects.toMatchObject({ status: 503 });
    expect(localStorage.getItem('dubchef-projects')).toBeNull();
  });

  it('từ chối URL video không thuộc endpoint media trước khi gửi token', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(() => projectApi.media(user, 'https://external.example/video.mp4')).toThrow('invalid');
    expect(fetch).not.toHaveBeenCalled();
  });
});
