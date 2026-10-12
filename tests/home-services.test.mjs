import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

// 앱과 같은 모듈 해석을 쓰되 환경 파일을 읽지 않고 mock을 고정한다.
test('홈 서비스: 공지 묶음, 면접 분리, 수정·원본 복원·재반영', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true },
    define: { 'import.meta.env.VITE_USE_MOCK': '"true"' },
    optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const events = await server.ssrLoadModule('/src/services/eventService.js');
    const calendar = await server.ssrLoadModule('/src/services/calendarService.js');
    const { mockStore } = await server.ssrLoadModule('/src/services/mockStore.js');
    mockStore.events.push(...[
      { id: 'home-app', notice_id: 100, event_type: 'application', end_date: '2026-05-22' },
      { id: 'home-event', notice_id: 100, event_type: 'event', start_date: '2026-05-23', end_date: '2026-05-23' },
      { id: 'home-interview', notice_id: 100, event_type: 'interview', start_date: '2026-05-24', end_date: '2026-05-24' },
    ].map((item) => ({ ...item, title: '서비스 검증 일정', review_status: 'auto', location: '원래 장소', registered: false, bookmarked: false })));

    const detail = await events.getEventDetail('home-app');
    assert.equal(detail.events.length, 3);
    await events.setBookmark('home-app', true);
    assert.ok((await events.getEventDetail('home-app')).events.every((event) => event.bookmarked));
    await calendar.registerEvent('home-app');
    let items = (await events.getEventDetail('home-app')).events;
    assert.deepEqual(items.filter((event) => event.registered).map((event) => event.id), ['home-app', 'home-event']);
    await calendar.registerInterview('home-interview');
    await calendar.unregisterEvent('home-app');
    items = (await events.getEventDetail('home-app')).events;
    assert.deepEqual(items.filter((event) => event.registered).map((event) => event.id), ['home-interview']);
    await calendar.registerEvent('home-app'); // 되돌리기와 같은 요청
    const modified = await events.updateOverrides('home-app', { end_date: '2026-05-25', location: '수정한 장소' });
    assert.equal(modified.user_modified, true);
    assert.equal(modified.sync_status, 'needs_sync');
    await calendar.syncEvent('home-app');
    assert.equal((await events.getEventDetail('home-app')).events[0].sync_status, 'synced');
    const restored = await events.updateOverrides('home-app', { end_date: null, location: null });
    assert.equal(restored.end_date, '2026-05-22');
    assert.equal(restored.location, '원래 장소');
    assert.equal(restored.user_modified, false);
    await assert.rejects(events.updateOverrides('home-app', { end_date: '2026-02-30' }));
    await assert.rejects(events.updateOverrides('home-app', { location: 10 }));
    await assert.rejects(events.updateOverrides('home-app', { start_date: '2026-05-30' }));
    assert.equal((await events.getEventDetail('home-app')).events[0].end_date, '2026-05-22');
    await events.setActionStatus('home-app', 'done');
    assert.equal((await events.getEventDetail('home-app')).events[0].action_status, 'done');
    await events.setDismissed('home-app', true);
    assert.ok(!(await events.getEvents()).some((event) => event.notice_id === 100));
    await events.setDismissed('home-app', false);
    assert.equal((await events.getEvents()).filter((event) => event.notice_id === 100).length, 3);
    await calendar.unregisterEvent('home-interview');
    await assert.rejects(calendar.syncEvent('home-interview'));
    await assert.rejects(calendar.registerInterview('home-app'));
    await calendar.unregisterEvent('ev4');
    await assert.rejects(calendar.registerEvent('ev4'));
    await calendar.registerEvent('ev4', {}, true);
    assert.equal((await events.getEventDetail('ev4')).events[0].registered, true);
  } finally { await server.close(); }
});

test('실제 API 분기는 수정 본문과 등록·해제·반영 경로를 계약대로 보낸다', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true },
    define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' },
    optimizeDeps: { noDiscovery: true, include: [] } });
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options) => {
    requests.push({ path, ...options, body: options.body ? JSON.parse(options.body) : undefined });
    return { ok: true, status: 200, json: async () => ({ id: 'a/b', registered: true }) };
  };
  try {
    const events = await server.ssrLoadModule('/src/services/eventService.js');
    const calendar = await server.ssrLoadModule('/src/services/calendarService.js');
    await events.updateOverrides('a/b', { start_date: null, location: '강의실' });
    await events.setBookmark('a/b', true);
    await events.setActionStatus('a/b', 'done');
    await events.setDismissed('a/b', true);
    await calendar.registerEvent('a/b', { 'a/b': { end_time: '14:00' } }, true);
    await calendar.unregisterEvent('a/b');
    await calendar.syncEvent('a/b');
    await calendar.registerInterview('a/b', {}, true);
    assert.deepEqual(requests.map(({ path, method, body }) => ({ path, method, body })), [
      { path: '/api/events/a%2Fb/overrides', method: 'PATCH', body: { start_date: null, location: '강의실' } },
      { path: '/api/events/a%2Fb/bookmark', method: 'PUT', body: { bookmarked: true } },
      { path: '/api/events/a%2Fb/action-status', method: 'PUT', body: { action_status: 'done' } },
      { path: '/api/events/a%2Fb/dismissed', method: 'PUT', body: { dismissed: true } },
      { path: '/api/calendar/register', method: 'POST', body: { event_id: 'a/b', overrides: { 'a/b': { end_time: '14:00' } }, confirmed: true } },
      { path: '/api/calendar/register/a%2Fb', method: 'DELETE', body: undefined },
      { path: '/api/calendar/sync/a%2Fb', method: 'POST', body: undefined },
      { path: '/api/calendar/interviews/a%2Fb', method: 'POST', body: { overrides: {}, confirmed: true } },
    ]);
    assert.ok(requests.every((request) => request.credentials === 'include'));
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
