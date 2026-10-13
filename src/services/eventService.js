import { USE_MOCK } from '../config/app';
import { ApiError, apiRequest, mockResponse } from './apiClient';
import { mockStore, updateMockEvent, mockSiblings, mockNoticeEvents, mockVisibleEvent, selectMockEvents, applyMockOverrides } from './mockStore';
import { buildReportBody } from '../utils/settings';

/**
 * 서버(또는 model repo 파이프라인) 응답 → 프론트 Event 형태로 정규화.
 * - model 출력은 start_date / location 이 '' 일 수 있음 → 그대로 '' 유지
 * - 크롤러 레코드의 `site` 필드도 source 로 인정
 */
export function normalizeEvent(raw) {
  return {
    id: String(raw.id ?? raw.source_url ?? ''),
    title: raw.title ?? raw.title_raw ?? '',
    start_date: raw.start_date ?? '',
    end_date: raw.end_date ?? '',
    location: raw.location ?? '',
    detail: raw.detail ?? '',
    source: raw.source ?? raw.site ?? '',
    source_url: raw.source_url ?? '',
    category: raw.category ?? null,
    is_new: Boolean(raw.is_new),
    registered: Boolean(raw.registered),
    bookmarked: Boolean(raw.bookmarked),
    collected_at: raw.collected_at ?? null,
    review_status: raw.review_status ?? raw.auto_register_status ?? null,
    notice_id: raw.notice_id ?? null,
    event_type: raw.event_type ?? 'event',
    start_time: raw.start_time ?? '',
    end_time: raw.end_time ?? '',
    timezone: raw.timezone ?? 'Asia/Seoul',
    attendance_mode: raw.attendance_mode ?? 'unknown',
    schedule_status: raw.schedule_status ?? 'confirmed',
    review_reason: raw.review_reason ?? '',
    revision: raw.revision ?? 1,
    can_register: raw.can_register ?? (USE_MOCK && Boolean(raw.end_date)),
    registration_reason: raw.registration_reason ?? '',
    sync_status: raw.sync_status ?? 'none',
    ai_extracted: Boolean(raw.ai_extracted),
    review_required: Boolean(raw.review_required),
    action_status: raw.action_status ?? 'pending',
    dismissed: Boolean(raw.dismissed),
    user_modified: Boolean(raw.user_modified),
  };
}

/** 일정 목록 — 향후 GET /api/events */
export async function getEvents(includeDismissed = false) {
  const data = USE_MOCK ? await mockResponse(selectMockEvents(mockStore.events, { includeDismissed, enabledSources: mockStore.preferences.enabled_sources }))
    : await apiRequest(`/api/events?include_dismissed=${includeDismissed}`);
  return data.map(normalizeEvent);
}

export async function getEventDetail(id) {
  if (USE_MOCK) {
    const anchor = mockStore.events.find((event) => String(event.id) === String(id));
    if (!anchor || !mockVisibleEvent(anchor)) throw new ApiError('공개된 일정을 찾을 수 없습니다.', { status: 404 });
    const siblings = mockNoticeEvents(id);
    const dismissed = anchor.notice_id != null && siblings.some(event => event.dismissed);
    const events = siblings.filter(mockVisibleEvent);
    return mockResponse({ notice_id: anchor.notice_id ?? null, dismissed, events: events.map(event => normalizeEvent({ ...event, dismissed })) });
  }
  const data = await apiRequest(`/api/events/${encodeURIComponent(id)}`);
  return { ...data, events: data.events.map(normalizeEvent) };
}

/** 북마크 설정 — PUT /api/events/:id/bookmark */
export async function setBookmark(id, bookmarked) {
  if (USE_MOCK) {
    mockSiblings(id).forEach((event) => updateMockEvent(event.id, { bookmarked }));
    return mockResponse({ id, bookmarked });
  }
  return apiRequest(`/api/events/${encodeURIComponent(id)}/bookmark`, { method: 'PUT', body: { bookmarked } });
}

export async function setActionStatus(id, action_status) {
  if (USE_MOCK) { updateMockEvent(id, { action_status }); return mockResponse({ id, action_status }); }
  return apiRequest(`/api/events/${encodeURIComponent(id)}/action-status`, { method: 'PUT', body: { action_status } });
}

export async function setDismissed(id, dismissed) {
  if (USE_MOCK) { mockNoticeEvents(id).forEach((event) => updateMockEvent(event.id, { dismissed })); return mockResponse({ id, dismissed }); }
  return apiRequest(`/api/events/${encodeURIComponent(id)}/dismissed`, { method: 'PUT', body: { dismissed } });
}

export async function updateOverrides(id, overrides) {
  if (USE_MOCK) return mockResponse(normalizeEvent(applyMockOverrides(id, overrides)));
  return apiRequest(`/api/events/${encodeURIComponent(id)}/overrides`, { method: 'PATCH', body: overrides });
}

export async function reportEvent(id, reason, memo) {
  const body = buildReportBody(reason, memo);
  if (USE_MOCK) return mockResponse({ saved: true }, 300);
  return apiRequest(`/api/events/${encodeURIComponent(id)}/reports`, { method: 'POST', body });
}
