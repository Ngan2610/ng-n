const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, token, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.code || 'API request failed');
  }

  return data;
}

export const videoAdminApi = {
  async getVideos(token) {
    return request('/api/admin/videos', token);
  },

  async getTranslations(videoId, token) {
    return request(
      `/api/admin/videos/${videoId}/translations`,
      token
    );
  },

  async updateStatus(videoId, status, token) {
    return request(`/api/admin/videos/${videoId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteVideo(videoId, token) {
    return request(`/api/admin/videos/${videoId}`, token, {
      method: 'DELETE'
    });
  }
};