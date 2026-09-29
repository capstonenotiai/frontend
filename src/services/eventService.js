import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';
import { mockStore, updateMockEvent } from './mockStore';

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
  };
}

/** 일정 목록 — 향후 GET /api/events */
export async function getEvents() {
  const data = USE_MOCK ? await mockResponse(mockStore.events) : await apiRequest('/api/events');
  return data.map(normalizeEvent);
}

/** 북마크 설정 — PUT /api/events/:id/bookmark */
export async function setBookmark(id, bookmarked) {
  if (USE_MOCK) {
    updateMockEvent(id, { bookmarked });
    return mockResponse({ id, bookmarked });
  }
  return apiRequest(`/api/events/${encodeURIComponent(id)}/bookmark`, { method: 'PUT', body: { bookmarked } });
}
