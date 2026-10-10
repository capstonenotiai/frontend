import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionTimeLabel, filterNotices, savedList, hiddenList } from '../src/utils/noticeFilters.js';
import { createServer } from 'vite';

const events = [
  { id: 'a', title: 'AI 장학', category: 'scholarship', source: 'cbnu', end_date: '2026-10-20', bookmarked: true },
  { id: 'b', title: 'AI 공모전', category: 'contest', source: 'wevity', end_date: '2026-10-12', bookmarked: true, registered: true },
  { id: 'c', title: '취업 설명회', category: 'career', source: 'cbnu', start_date: '2026-10-15' },
  { id: 'd', title: '날짜 없는 공지', category: 'scholarship', source: 'wevity', bookmarked: true, dismissed: true },
  { id: 'e', title: '가나다 장학', category: 'scholarship', source: 'cbnu', end_date: '2026-10-20' },
];
const ids = (items) => items.map(({ id }) => id);

test('분야·출처·제목 검색은 각각 적용되며 공백·대소문자를 무시한다', () => {
  assert.deepEqual(ids(filterNotices(events, { category: 'scholarship' })), ['e', 'a', 'd']);
  assert.deepEqual(ids(filterNotices(events, { source: 'wevity' })), ['b', 'd']);
  assert.deepEqual(ids(filterNotices(events, { query: '  aI  ' })), ['b', 'a']);
  assert.deepEqual(ids(filterNotices(events, { category: 'scholarship', source: 'cbnu', query: ' ai ' })), ['a']);
  assert.deepEqual(filterNotices(events, { query: 'cbnu' }), []); // 출처가 아니라 제목만 검색
  assert.deepEqual(filterNotices(events, { category: 'activity' }), []);
  assert.deepEqual(ids(filterNotices(events, { category: 'all', source: 'all', query: '  ' })), ids(filterNotices(events)));
});

test('마감순, 시작일 대체, 같은 날 제목순, 날짜 없는 공지는 마지막이며 원본을 보존한다', () => {
  const before = structuredClone(events);
  assert.deepEqual(ids(filterNotices(events)), ['b', 'c', 'e', 'a', 'd']);
  assert.deepEqual(events, before);
  assert.deepEqual(filterNotices([]), []);
});

test('관심 저장은 저장·등록·숨김 8가지 조합 중 저장+미등록+보임만 포함한다', () => {
  const combinations = [false, true].flatMap((bookmarked) => [false, true].flatMap((registered) =>
    [false, true].map((dismissed) => ({ bookmarked, registered, dismissed, title: '', id: `${bookmarked}/${registered}/${dismissed}` }))));
  assert.deepEqual(ids(savedList(combinations)), ['true/false/false']);
  assert.deepEqual(ids(savedList([...events, { id: 'f', title: '빠른 저장', bookmarked: true, end_date: '2026-10-11' }])), ['f', 'a']);
});

test('숨긴 공지만 마감순으로 반환하며 원본은 변경하지 않는다', () => {
  const items = [...events, { id: 'f', title: '숨긴 공지', dismissed: true, end_date: '2026-10-11' }];
  const before = structuredClone(items);
  assert.deepEqual(ids(hiddenList(items)), ['f', 'd']);
  assert.deepEqual(items, before);
  assert.deepEqual(hiddenList([]), []);
});

test('수집 시각은 한국 시각 기준 오늘·이전 날짜·HH:mm·값 없음으로 구분한다', () => {
  const now = new Date('2026-10-11T08:00:00+09:00');
  assert.equal(collectionTimeLabel('2026-10-11T00:04:00Z', now), '오늘 오전 9:04');
  assert.equal(collectionTimeLabel('2026-10-10T09:04:00+09:00', now), '10월 10일 오전 9:04');
  assert.equal(collectionTimeLabel('2026-10-10T15:04:00Z', now), '오늘 오전 12:04');
  assert.equal(collectionTimeLabel('13:04', now), '오후 1:04');
  assert.equal(collectionTimeLabel('09:00', now), '오전 9:00');
  for (const value of [null, '', '-', 'unknown', '24:00', '13:99']) assert.equal(collectionTimeLabel(value, now), '');
});

test('mock 공지의 저장·등록·숨김·복원이 기본/저장/숨김 목록과 배지에 반영된다', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, ws: false },
    define: { 'import.meta.env.VITE_USE_MOCK': '"true"' }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const service = await server.ssrLoadModule('/src/services/eventService.js');
    const calendar = await server.ssrLoadModule('/src/services/calendarService.js');
    const { countSaved } = await server.ssrLoadModule('/src/utils/foundation.js');
    const { mockStore } = await server.ssrLoadModule('/src/services/mockStore.js');
    mockStore.events.push({ id: 'notice-workflow', notice_id: 300, title: '공지 흐름', event_type: 'application',
      end_date: '2026-10-20', review_status: 'auto', registered: false, bookmarked: false, dismissed: false });
    const hasTarget = (items) => items.some(({ id }) => id === 'notice-workflow');
    const initialSaved = countSaved(await service.getEvents());
    await service.setBookmark('notice-workflow', true);
    assert.ok(hasTarget(savedList(await service.getEvents())));
    assert.equal(countSaved(await service.getEvents()), initialSaved + 1);
    await service.setBookmark('notice-workflow', false);
    assert.ok(!hasTarget(savedList(await service.getEvents())));
    await service.setBookmark('notice-workflow', true); // 저장 해제 되돌리기
    await calendar.registerEvent('notice-workflow');
    assert.ok(!hasTarget(savedList(await service.getEvents())));
    assert.equal(countSaved(await service.getEvents()), initialSaved);
    const initialHidden = hiddenList(await service.getEvents(true)).length;
    await service.setDismissed('notice-workflow', true);
    assert.ok(!hasTarget(await service.getEvents()));
    assert.equal(hiddenList(await service.getEvents(true)).length, initialHidden + 1);
    await service.setDismissed('notice-workflow', false);
    assert.ok(hasTarget(await service.getEvents()));
    assert.equal(hiddenList(await service.getEvents(true)).length, initialHidden);
  } finally { await server.close(); }
});

test('실제 목록 요청은 숨김 포함 여부를 API 쿼리로 구분한다', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, ws: false },
    define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' },
    optimizeDeps: { noDiscovery: true, include: [] } });
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options) => {
    requests.push({ path, ...options });
    return { ok: true, status: 200, json: async () => [] };
  };
  try {
    const service = await server.ssrLoadModule('/src/services/eventService.js');
    await service.getEvents();
    await service.getEvents(true);
    assert.deepEqual(requests.map(({ path }) => path), ['/api/events?include_dismissed=false', '/api/events?include_dismissed=true']);
    assert.ok(requests.every(({ credentials }) => credentials === 'include'));
  } finally { globalThis.fetch = previousFetch; await server.close(); }
});
