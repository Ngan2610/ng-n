import { ApiError, request } from './client.js';

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const projectApi = {
  async upload(user, file) {
    if (!VIDEO_TYPES.includes(file.type)) throw new ApiError('video_type');
    if (file.size > MAX_VIDEO_BYTES) throw new ApiError('video_size');
    return request('/api/uploads', {
      method: 'POST', token: user.token, body: file, raw: true,
      headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
    });
  },
  create: (user, body) => request('/api/projects', { method: 'POST', token: user.token, body }),
  list: (user) => request('/api/projects', { token: user.token }),
  messages: (user) => request('/api/account/messages', { token: user.token }),
  media: (user, path, signal) => {
    if (!/^\/api\/media\/[a-zA-Z0-9-]+\.(mp4|webm|mov)$/.test(path || '')) throw new ApiError('invalid');
    return request(path, { token: user.token, blob: true, signal });
  },
};

export function projectError(error) {
  if (error.code === 'video_size' || error.status === 413) return 'Video vượt quá giới hạn 100 MB. Vui lòng chọn video nhỏ hơn.';
  if (error.code === 'video_type') return 'Chỉ hỗ trợ lưu video MP4, WebM hoặc MOV.';
  if (error.status === 401 || error.status === 403) return 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.';
  if (error.code === 'invalid') return 'Dữ liệu dự án chưa hợp lệ. Kiểm tra tiêu đề, nội dung và mốc thời gian.';
  return 'Không thể kết nối hoặc lưu dữ liệu. Vui lòng thử lại; dữ liệu chưa được xác nhận lưu.';
}
