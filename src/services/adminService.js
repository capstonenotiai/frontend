import { apiRequest } from './apiClient';

export const getQueue = (state, offset, signal) => apiRequest(`/api/admin/notices?state=${encodeURIComponent(state)}&offset=${offset}`, { signal });
export const getNotice = (id, signal) => apiRequest(`/api/admin/notices/${id}`, { signal });
export const reviewNotice = (id, body) => apiRequest(`/api/admin/notices/${id}/review`, { method: 'POST', body });
