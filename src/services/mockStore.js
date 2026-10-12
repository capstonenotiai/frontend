import { mockEvents } from '../data/mockEvents';
import { mockPreferences, mockProfile } from '../data/mockUser';
import { mockNotifications } from '../data/mockNotifications';

/**
 * mock 모드 전용 "가짜 서버" 상태.
 * 등록/북마크/설정 변경이 '새로고침' 후에도 유지되도록 services 들이 이 객체를 공유한다.
 * (브라우저 새로고침 시에는 초기화됨 — DB 가 아님)
 */
export const mockStore = {
  events: structuredClone(mockEvents),
  profile: structuredClone(mockProfile),
  preferences: structuredClone(mockPreferences),
  notifications: structuredClone(mockNotifications),
};

export function updateMockEvent(id, patch) {
  const event = mockStore.events.find((item) => item.id === id);
  if (!event) throw new Error(`일정을 찾을 수 없습니다: ${id}`);
  Object.assign(event, patch);
  return event;
}

export function mockSiblings(id) {
  const anchor = mockStore.events.find((event) => String(event.id) === String(id));
  if (!anchor) throw new Error('일정을 찾을 수 없습니다.');
  return mockStore.events.filter((event) => (event === anchor || (anchor.notice_id != null && event.notice_id === anchor.notice_id))
    && ['auto', 'approved'].includes(event.review_status) && !['result', 'service_change', 'award', 'survey'].includes(event.event_type));
}

const overrideFields = ['start_date', 'end_date', 'start_time', 'end_time', 'location'];
const mockOriginals = new Map();
const mockOverrides = new Map();

/** 개인 수정과 원본 복원을 실제 API와 같은 값으로 모의한다. */
export function applyMockOverrides(id, patch) {
  const event = mockStore.events.find((item) => String(item.id) === String(id));
  if (!event) throw new Error('일정을 찾을 수 없습니다.');
  const original = mockOriginals.get(id) || Object.fromEntries(overrideFields.map((key) => [key, event[key] || '']));
  const overrides = { ...mockOverrides.get(id) };
  for (const [key, value] of Object.entries(patch)) {
    if (!overrideFields.includes(key) || (value !== null && typeof value !== 'string')) throw new Error('날짜·시각·장소 수정 값을 확인해 주세요.');
    if (value === null) delete overrides[key]; else overrides[key] = value;
  }
  const next = { ...original, ...overrides };
  const validDate = (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
  const validTime = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validDate(next.start_date) || !validDate(next.end_date) || !validTime(next.start_time) || !validTime(next.end_time)
    || (next.start_time && !next.start_date) || (next.end_time && !next.end_date)
    || (next.start_date && next.end_date && next.start_date > next.end_date)
    || (next.start_date === next.end_date && next.start_time && next.end_time && next.start_time > next.end_time)
    || next.location.length > 255) throw new Error('날짜·시각·장소 수정 값을 확인해 주세요.');
  mockOriginals.set(id, original);
  mockOverrides.set(id, overrides);
  Object.assign(event, next, { user_modified: Object.keys(overrides).length > 0, sync_status: event.registered ? 'needs_sync' : 'none' });
  return event;
}
