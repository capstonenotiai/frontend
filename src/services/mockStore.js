import { mockEvents } from '../data/mockEvents';
import { mockPreferences, mockProfile } from '../data/mockUser';
import { mockNotifications } from '../data/mockNotifications';
import { MOCK_TODAY } from '../config/app';

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

const hiddenTypes = new Set(['result', 'service_change', 'award', 'survey']);
const applicationTypes = new Set(['application', 'submission']);
const dayMs = 86_400_000, seoulOffset = 9 * 3_600_000;
const compareIds = (a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true });
const compareDates = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// backend/display_rules.py: old fixtures omit event_type, which normalizeEvent treats as 'event'.
function serviceExcluded(event) {
  const compact = (event.title || '').replace(/[\s()]/g, '');
  return hiddenTypes.has(event.event_type) || ((event.event_type ?? 'event') === 'event'
    && ['결과발표', '시상식', '선택설문', '설문선택', '시스템중단', '서비스중단안내'].some(label => compact.includes(label)));
}

export function mockVisibleEvent(event) {
  return !serviceExcluded(event) && (['auto', 'approved'].includes(event.review_status) || event.registered);
}

function deadline(event) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.end_date || '')) return NaN;
  const date = Date.parse(`${event.end_date}T00:00:00Z`);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== event.end_date) return NaN;
  const time = event.end_time || '23:59:59.999';
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(time)) return NaN;
  return Date.parse(`${event.end_date}T${time}+09:00`);
}

/** GET /api/events parity. Mock time stays at the configured Seoul demo day's midnight. */
export function selectMockEvents(events, { includeDismissed = false, enabledSources = {},
  now = new Date(`${MOCK_TODAY}T00:00:00+09:00`) } = {}) {
  const timestamp = now.getTime();
  const cutoffDate = new Date(timestamp + seoulOffset - 90 * dayMs).toISOString().slice(0, 10);
  const dismissedNotices = new Set(events.filter(event => event.notice_id != null && event.dismissed).map(event => event.notice_id));
  const groups = new Map();
  for (const event of events) {
    if (!mockVisibleEvent(event) || enabledSources[event.source] === false
      || (!includeDismissed && dismissedNotices.has(event.notice_id))) continue;
    const key = event.notice_id == null ? `event:${event.id}` : `notice:${event.notice_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const output = [];
  for (const rows of groups.values()) {
    const publicEvents = rows.filter(event => ['auto', 'approved'].includes(event.review_status) && event.schedule_status !== 'cancelled');
    const applications = publicEvents.filter(event => applicationTypes.has(event.event_type));
    let chosen;
    if (applications.length) {
      chosen = applications.filter(event => deadline(event) >= timestamp)
        .sort((a, b) => deadline(a) - deadline(b) || compareIds(a, b))[0];
    } else {
      const main = publicEvents.filter(event => (event.event_type ?? 'event') === 'event');
      const upcoming = main.filter(event => deadline(event) >= timestamp);
      chosen = (upcoming.length ? upcoming : main)
        .sort((a, b) => compareDates(a.start_date || a.end_date || '9999', b.start_date || b.end_date || '9999') || compareIds(a, b))[0];
    }
    if (!chosen) continue; // Closed applications cannot be revived by a retained/registered main event.
    const bookmarked = rows.some(event => event.bookmarked);
    if (!((chosen.end_date || '') >= cutoffDate
      || (!chosen.end_date && Date.parse(chosen.collected_at) >= timestamp - 90 * dayMs)
      || chosen.registered || bookmarked)) continue;
    output.push({ ...chosen, bookmarked, dismissed: dismissedNotices.has(chosen.notice_id) });
  }
  return output.sort((a, b) => compareDates(a.end_date || '9999', b.end_date || '9999') || compareIds(a, b));
}

export function mockNoticeEvents(id) {
  const anchor = mockStore.events.find(event => String(event.id) === String(id));
  if (!anchor) throw new Error('일정을 찾을 수 없습니다.');
  return mockStore.events.filter(event => event === anchor || (anchor.notice_id != null && event.notice_id === anchor.notice_id));
}

export function updateMockEvent(id, patch) {
  const event = mockStore.events.find((item) => item.id === id);
  if (!event) throw new Error(`일정을 찾을 수 없습니다: ${id}`);
  Object.assign(event, patch);
  return event;
}

export function mockSiblings(id) {
  return mockNoticeEvents(id).filter(event => ['auto', 'approved'].includes(event.review_status) && !serviceExcluded(event));
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
