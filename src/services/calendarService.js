import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';
import { updateMockEvent } from './mockStore';

/**
 * Google Calendar 등록.
 * 현재는 mock 으로 registered 값만 바꾼다. (Google OAuth / Calendar API 는 백엔드에서 처리 예정)
 */

/** 향후 POST /api/calendar/register */
export async function registerEvent(id) {
  if (USE_MOCK) {
    updateMockEvent(id, { registered: true });
    return mockResponse({ id, registered: true });
  }
  return apiRequest('/api/calendar/register', { method: 'POST', body: { event_id: id } });
}

/** 향후 DELETE /api/calendar/register/:id */
export async function unregisterEvent(id) {
  if (USE_MOCK) {
    updateMockEvent(id, { registered: false });
    return mockResponse({ id, registered: false });
  }
  return apiRequest(`/api/calendar/register/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** 여러 일정 일괄 등록 (현재는 단건 등록을 반복) */
export async function registerEvents(ids) {
  return Promise.all(ids.map((id) => registerEvent(id)));
}
