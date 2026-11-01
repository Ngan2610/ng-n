const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function adminRequest(user, path, body) {
  if (!user?.token) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  let response;
  try {
    response = await fetch(BASE + path, {
      method: body === undefined ? 'GET' : 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages = {
      400: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra nội dung và thời gian.',
      401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      403: 'Bạn không có quyền quản trị hoặc tài khoản đã bị khóa.',
      404: 'Dữ liệu không còn tồn tại. Hãy làm mới danh sách.',
    };
    throw new Error(messages[response.status] || 'Không thể đọc hoặc lưu dữ liệu. Vui lòng thử lại.');
  }
  return data;
}

export const serviceAdminApi = {
  narrations: (user) => adminRequest(user, '/api/admin/narrations').then((data) => data.narrations || []),
  saveNarration: (user, id, body) => adminRequest(user, `/api/admin/narrations/${id}`, body).then((data) => data.narration),
  subtitles: (user) => adminRequest(user, '/api/admin/subtitles').then((data) => data.subtitles || []),
  saveSubtitle: (user, id, body) => adminRequest(user, `/api/admin/subtitles/${id}`, body).then((data) => data.subtitle),
  feedback: (user) => adminRequest(user, '/api/admin/feedback').then((data) => data.feedback || []),
  saveFeedback: (user, id, body) => adminRequest(user, `/api/admin/feedback/${id}`, body).then((data) => data.feedback),
  videos: (user) => adminRequest(user, '/api/admin/videos').then((data) => data.videos || []),
};
