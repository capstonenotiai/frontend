import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';
import { mockStore, updateMockEvent, mockSiblings, applyMockOverrides } from './mockStore';
import { normalizeEvent } from './eventService';

/**
 * Google Calendar 등록.
 * 현재는 mock 으로 registered 값만 바꾼다. (Google OAuth / Calendar API 는 백엔드에서 처리 예정)
 */

/** 향후 POST /api/calendar/register */
export async function registerEvent(id, overrides = {}, confirmed = false) {
  if (USE_MOCK) {
    const targets = mockSiblings(id).filter((event) => event.event_type !== 'interview' && event.schedule_status !== 'cancelled');
    if (!targets.length || targets.some((event) => event.can_register === false)) throw new Error('등록할 수 없는 일정이 있어요.');
    if (!confirmed && targets.some((event) => event.review_required)) throw new Error('공지에서 날짜를 한 번 확인해 주세요.');
    for (const event of targets) {
      if (overrides[event.id]) applyMockOverrides(event.id, overrides[event.id]);
      updateMockEvent(event.id, { registered: true, sync_status: 'synced' });
    }
    return mockResponse({ id, registered: true });
  }
  return apiRequest('/api/calendar/register', { method: 'POST', body: { event_id: id, overrides, confirmed } });
}

/** 향후 DELETE /api/calendar/register/:id */
export async function unregisterEvent(id) {
  if (USE_MOCK) {
    const anchor = mockStore.events.find((event) => event.id === id);
    const targets = anchor?.event_type === 'interview' ? [anchor] : mockSiblings(id).filter((event) => event.event_type !== 'interview');
    targets.forEach((event) => updateMockEvent(event.id, { registered: false, sync_status: 'none' }));
    return mockResponse({ id, registered: false });
  }
  return apiRequest(`/api/calendar/register/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** 여러 일정 일괄 등록 (현재는 단건 등록을 반복) */
export async function registerEvents(ids) {
  return Promise.all(ids.map((id) => registerEvent(id)));
}

export async function syncEvent(id) {
  if (USE_MOCK) {
    const event = mockStore.events.find((event) => event.id === id);
    if (!event?.registered) throw new Error('등록된 일정만 갱신할 수 있습니다.');
    updateMockEvent(id, { sync_status: 'synced' });
    return mockResponse({ id, registered: true });
  }
  return apiRequest(`/api/calendar/sync/${encodeURIComponent(id)}`, { method: 'POST' });
}

export async function getRegisteredEvents() {
  const data = USE_MOCK ? await mockResponse(mockStore.events.filter((event) => event.registered && event.event_type !== 'result'))
    : await apiRequest('/api/calendar/events');
  return data.map(normalizeEvent);
}

export async function registerInterview(id, overrides = {}, confirmed = false) {
  if (USE_MOCK) {
    const event = mockStore.events.find((event) => event.id === id);
    if (event?.event_type !== 'interview') throw new Error('면접 일정만 개별 추가할 수 있습니다.');
    if (event.can_register === false) throw new Error('등록할 수 없는 일정이에요.');
    if (event.review_required && !confirmed) throw new Error('공지에서 날짜를 한 번 확인해 주세요.');
    if (overrides[id]) applyMockOverrides(id, overrides[id]);
    updateMockEvent(id, { registered: true, sync_status: 'synced' }); return mockResponse({ id, registered: true });
  }
  return apiRequest(`/api/calendar/interviews/${encodeURIComponent(id)}`, { method: 'POST', body: { overrides, confirmed } });
}
