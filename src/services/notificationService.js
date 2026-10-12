import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';
import { mockStore } from './mockStore';

const visibleNotifications = () => mockStore.notifications.filter(item => {
  const event = mockStore.events.find(event => String(event.id) === String(item.event_id));
  return !event || mockStore.preferences.enabled_sources[event.source] !== false;
});
export function getUnreadCount() {
  return USE_MOCK ? mockResponse({ count: visibleNotifications().filter((item) => !item.read).length })
    : apiRequest('/api/notifications/unread-count');
}
export function listNotifications({ before } = {}) {
  if (USE_MOCK) {
    const remaining = visibleNotifications().filter((item) => !before || Number(item.id) < Number(before));
    const items = remaining.slice(0, 20);
    return mockResponse({ items, next_before: remaining.length > 20 ? items.at(-1).id : null });
  }
  const query = new URLSearchParams({ limit: '20' });
  if (before) query.set('before', before);
  return apiRequest(`/api/notifications?${query}`);
}
export function markRead(id) {
  if (USE_MOCK) {
    const item = mockStore.notifications.find((entry) => entry.id === String(id));
    if (item) item.read = true;
    return mockResponse({ id: String(id), read: true });
  }
  return apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}
export function markAllRead() {
  if (USE_MOCK) {
    const updated = mockStore.notifications.filter((item) => !item.read).length;
    mockStore.notifications.forEach((item) => { item.read = true; });
    return mockResponse({ updated });
  }
  return apiRequest('/api/notifications/read-all', { method: 'POST' });
}
