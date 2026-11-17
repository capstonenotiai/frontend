import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Contract reference: backend feature/service-v9, services/events.py + display_rules.py.
const event = (id, notice_id = id, patch = {}) => ({ id: String(id), notice_id, title: '공지',
  event_type: 'event', review_status: 'auto', source: 'cbnu', end_date: '2026-05-22',
  collected_at: '2026-05-19T00:00:00+09:00', registered: false, bookmarked: false, dismissed: false, ...patch });
const ids = items => items.map(item => item.id);

test('R33 Mock 공지·상세·캘린더 API 계약', async t => {
  const server = await createServer({ configFile: false, envDir: false,
    define: { 'import.meta.env.VITE_USE_MOCK': '"true"' },
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const service = await server.ssrLoadModule('/src/services/eventService.js');
    const calendar = await server.ssrLoadModule('/src/services/calendarService.js');
    const store = await server.ssrLoadModule('/src/services/mockStore.js');
    const demo = structuredClone(store.mockStore.events);
    const reset = rows => { store.mockStore.events = structuredClone(rows); store.mockStore.preferences.enabled_sources = {}; };
    await t.test('공지당 하나: 미마감 접수·제출 중 가장 가까운 마감과 숫자 ID 순', async () => {
      reset([event(30, 1, { event_type: 'event', end_date: '2026-05-19' }),
        event(10, 1, { event_type: 'application', end_date: '2026-05-23' }),
        event(9, 1, { event_type: 'submission', end_date: '2026-05-20', end_time: '14:00' }),
        event(2, 1, { event_type: 'application', end_date: '2026-05-20', end_time: '14:00' }),
        event(1, 1, { event_type: 'application', end_date: '2026-05-18' })]);
      assert.deepEqual(ids(await service.getEvents()), ['2']);
      assert.equal((await service.getEventDetail('9')).events.length, 5);
    });
    await t.test('모든 접수 마감은 관심·등록·미래 본행사·보존기간과 무관하게 제외', async () => {
      reset([event(1, 1, { event_type: 'application', end_date: '2026-05-18', registered: true, bookmarked: true }),
        event(2, 1, { end_date: '2026-06-01', registered: true, bookmarked: true })]);
      assert.deepEqual(await service.getEvents(), []);
      assert.deepEqual(ids(await calendar.getRegisteredEvents()), ['1', '2']);
      assert.deepEqual(ids((await service.getEventDetail('2')).events), ['1', '2']);
    });
    await t.test('마감 미확인 접수도 본행사로 대체해 되살리지 않는다', async () => {
      reset([event(1, 1, { event_type: 'submission', end_date: '' }), event(2, 1)]);
      assert.deepEqual(await service.getEvents(), []);
    });
    await t.test('접수 없는 본행사는 미마감 후보 중 시작일순, 모두 종료되면 기존 본행사순', async () => {
      reset([event(1, 1, { start_date: '2026-05-10', end_date: '2026-05-18' }),
        event(2, 1, { start_date: '2026-05-25', end_date: '2026-05-26' }),
        event(3, 1, { start_date: '2026-05-20', end_date: '2026-05-29' })]);
      assert.deepEqual(ids(await service.getEvents()), ['3']);
      store.mockStore.events.forEach(item => { item.end_date = '2026-05-18'; });
      assert.deepEqual(ids(await service.getEvents()), ['1']);
    });
    await t.test('공지 없는 일정은 각각 유지하고 최종 목록은 마감·숫자 ID순', async () => {
      reset([event(10, null), event(2, null), event(3, 3, { end_date: '' }), event(1, 1, { end_date: '2026-05-20' })]);
      assert.deepEqual(ids(await service.getEvents()), ['1', '2', '10', '3']);
    });
    await t.test('공개·검토·취소·비서비스 유형과 제목을 서버 규칙으로 구분', async () => {
      reset([event(1, 1, { review_status: 'needs_review' }), event(2, 2, { review_status: 'rejected' }),
        event(3, 3, { schedule_status: 'cancelled' }), event(4, 4, { event_type: 'interview' }),
        ...['result', 'service_change', 'award', 'survey'].map((event_type, i) => event(10 + i, 10 + i, { event_type })),
        ...['결 과 발표', '(시상식)', '선택 설문', '설문 선택', '시스템 중단', '서비스 중단 안내'].map((title, i) => event(20 + i, 20 + i, { title })),
        event(30, 30, { review_status: 'approved', review_required: true }),
        event(31, 31, { event_type: 'application', schedule_status: 'cancelled' }), event(32, 31),
        event(33, 32, { event_type: 'application', review_status: 'needs_review' }), event(34, 32)]);
      assert.deepEqual(ids(await service.getEvents()), ['30', '32', '34']);
    });
    await t.test('숨김은 공지 단위이고 복원해도 대표 하나만 노출하며 캘린더는 유지', async () => {
      reset([event(1, 1, { event_type: 'application' }), event(2, 1, { registered: true }),
        event(3, 1, { review_status: 'needs_review' })]);
      await service.setDismissed('2', true);
      assert.deepEqual(await service.getEvents(), []);
      assert.deepEqual(ids(await service.getEvents(true)), ['1']);
      assert.equal((await service.getEvents(true))[0].dismissed, true);
      assert.equal((await service.getEventDetail('2')).dismissed, true);
      assert.deepEqual(ids(await calendar.getRegisteredEvents()), ['2']);
      assert.equal((await calendar.getRegisteredEvents())[0].dismissed, false);
      await service.setDismissed('1', false);
      assert.deepEqual(ids(await service.getEvents()), ['1']);
      assert.ok(store.mockStore.events.every(item => !item.dismissed));
    });
    await t.test('출처 off는 공지 목록만 제외하고 상세·등록 캘린더는 유지', async () => {
      reset([event(1, 1, { source: 'wevity', registered: true }), event(2, 2)]);
      store.mockStore.preferences.enabled_sources.wevity = false;
      assert.deepEqual(ids(await service.getEvents(true)), ['2']);
      assert.deepEqual(ids(await calendar.getRegisteredEvents()), ['1']);
      assert.equal((await service.getEventDetail('1')).events[0].id, '1');
    });
    await t.test('관심은 공지 전체에 반영, 등록·완료는 대표와 비대표에서 서로 차용하지 않는다', async () => {
      reset([event(1, 1, { event_type: 'application' }), event(2, 1, { event_type: 'interview' })]);
      await service.setBookmark('2', true);
      await calendar.registerInterview('2'); await service.setActionStatus('2', 'done');
      let row = (await service.getEvents())[0];
      assert.equal(row.bookmarked, true); assert.equal(row.registered, false); assert.equal(row.action_status, 'pending');
      assert.deepEqual(ids(await calendar.getRegisteredEvents()), ['2']);
      await calendar.unregisterEvent('2'); await service.setBookmark('1', false);
      assert.ok((await service.getEventDetail('2')).events.every(item => !item.bookmarked));
      // Older fixtures may carry bookmark state on only one sibling; list still aggregates the notice.
      store.mockStore.events[1].bookmarked = true;
      assert.equal((await service.getEvents())[0].bookmarked, true);
      await calendar.registerEvent('1');
      assert.deepEqual(ids(await calendar.getRegisteredEvents()), ['1']);
      await calendar.unregisterEvent('1'); assert.deepEqual(await calendar.getRegisteredEvents(), []);
    });
    await t.test('대표 변경에도 관심은 유지하고 개인 날짜 수정이 대표 선정에 반영된다', async () => {
      reset([event(1, 1, { event_type: 'application' }), event(2, 1, { event_type: 'submission', end_date: '2026-05-23' })]);
      await service.setBookmark('1', true); await service.updateOverrides('1', { end_date: '2026-05-24' });
      assert.deepEqual(ids(await service.getEvents()), ['2']); assert.equal((await service.getEvents())[0].bookmarked, true);
      await service.updateOverrides('1', { end_date: null }); assert.deepEqual(ids(await service.getEvents()), ['1']);
    });
    await t.test('90일 경계: 종료일 우선, 날짜 없으면 수집시각, 대표 등록·공지 관심만 예외', async () => {
      reset([event(1, 1, { end_date: '2026-02-18' }), event(2, 2, { end_date: '2026-02-17' }),
        event(3, 3, { end_date: '', collected_at: '2026-02-18T00:00:00+09:00' }),
        event(4, 4, { end_date: '', collected_at: '2026-02-17T23:59:59+09:00' }),
        event(5, 5, { end_date: '2026-02-17', registered: true }), event(6, 6, { end_date: '2026-02-17', bookmarked: true }),
        event(7, 7, { end_date: '2026-02-17' }), event(8, 7, { event_type: 'interview', registered: true }),
        event(9, 9, { end_date: '2026-02-17', collected_at: '2026-05-19T00:00:00+09:00' }),
        event(10, 10, { end_date: '', collected_at: null })]);
      assert.deepEqual(ids(await service.getEvents()), ['5', '6', '1', '3']);
      assert.deepEqual(ids(await calendar.getRegisteredEvents()), ['5', '8']);
    });
    await t.test('상세는 대표·보존기간에 구애받지 않으며 공개 또는 등록된 실제 대상만 포함', async () => {
      reset([event(1, 1, { event_type: 'application', end_date: '2026-01-01' }),
        event(2, 1, { event_type: 'interview', registered: true, action_status: 'done' }),
        event(3, 1, { review_status: 'needs_review', registered: true }),
        event(4, 1, { review_status: 'rejected' }), event(5, 1, { event_type: 'result', registered: true }),
        event(6, 1, { title: '시상식', registered: true }), event(7, 1, { schedule_status: 'cancelled' })]);
      assert.deepEqual(await service.getEvents(), []);
      assert.deepEqual(ids((await service.getEventDetail('2')).events), ['1', '2', '3', '7']);
      assert.deepEqual(ids(await calendar.getRegisteredEvents()), ['2', '3']);
      for (const id of ['404', '4', '5', '6']) await assert.rejects(service.getEventDetail(id), error => error.status === 404);
    });
    await t.test('조회·정렬·응답 수정은 Mock 원본과 원본 데모를 변형하지 않는다', async () => {
      reset([event(2, 1), event(1, 1, { event_type: 'application' })]);
      const before = structuredClone(store.mockStore);
      const list = await service.getEvents(); list[0].title = '외부 수정';
      const detail = await service.getEventDetail('2'); detail.events[0].registered = true;
      await service.getEvents(true); await calendar.getRegisteredEvents();
      assert.deepEqual(store.mockStore, before);
      reset(demo); assert.equal((await service.getEvents()).length, 9);
      assert.deepEqual(store.mockStore.events, demo);
    });
    await t.test('서울 마감시각과 마감일 종료 경계는 고정 Mock 날짜와 별도로 비교 가능', () => {
      const select = (rows, now) => ids(store.selectMockEvents(rows, { now: new Date(now) }));
      const rows = [event(1, 1, { event_type: 'application', end_date: '2026-05-19', end_time: '14:00' }),
        event(2, 1, { event_type: 'submission', end_date: '2026-05-19' }),
        event(3, 1, { end_date: '2026-05-25' })];
      assert.deepEqual(select(rows, '2026-05-19T05:00:00Z'), ['1']);
      assert.deepEqual(select(rows, '2026-05-19T05:00:00.001Z'), ['2']);
      assert.deepEqual(select(rows, '2026-05-19T14:59:59.999Z'), ['2']);
      assert.deepEqual(select(rows, '2026-05-19T15:00:00Z'), []);
      assert.deepEqual(select([event(4, 4, { event_type: 'application', end_date: '2026-02-30' })], '2026-02-28T00:00:00+09:00'), []);
    });
  } finally { await server.close(); }
});

test('R33 Mock 기준 날짜 설정은 실제 시스템 날짜와 독립적이다', async () => {
  const server = await createServer({ configFile: false, envDir: false,
    define: { 'import.meta.env.VITE_USE_MOCK': '"true"', 'import.meta.env.VITE_MOCK_TODAY': '"2026-06-06"' },
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { getEvents } = await server.ssrLoadModule('/src/services/eventService.js');
    const { getRegisteredEvents } = await server.ssrLoadModule('/src/services/calendarService.js');
    assert.deepEqual(ids(await getEvents()), ['ev3', 'ev9']); // Retained main event + still-open submission.
    assert.deepEqual(ids(await getRegisteredEvents()), ['ev1', 'ev2', 'ev3', 'ev4', 'ev5', 'ev6']);
  } finally { await server.close(); }
});

const playwright = await import(process.env.R33_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);
test('R33 Chromium: 실제 Mock 앱의 대표 목록·비대표 알림·숨김·등록·한글 검색', {
  skip: !playwright && 'Playwright 미설치: R33_PLAYWRIGHT_MODULE을 지정하세요.', timeout: 120_000,
}, async t => {
  const rows = [event(100, 10, { title: '장학 공지', category: 'scholarship', event_type: 'application', end_date: '2026-05-22' }),
    event(101, 10, { title: '장학 본행사', category: 'scholarship', end_date: '2026-05-30', registered: true, action_status: 'done' }),
    event(102, 10, { title: '장학 면접', category: 'scholarship', event_type: 'interview', end_date: '2026-05-25' }),
    event(200, 20, { title: '취업 공지', category: 'career', source: 'wevity', event_type: 'submission', end_date: '2026-05-24' })];
  const entry = `
    import { mockStore } from '/src/services/mockStore.js';
    import * as events from '/src/services/eventService.js';
    import * as calendar from '/src/services/calendarService.js';
    mockStore.events = ${JSON.stringify(rows)};
    mockStore.profile.onboarding_done = true;
    mockStore.notifications = [{ id: 'r33-notification', event_id: '102', title: '면접 알림', message: '면접 일정 확인', read: false, created_at: '2026-05-19T09:00:00+09:00' }];
    if (new URLSearchParams(location.search).has('closed')) mockStore.events[0].end_date = '2026-05-18';
    window.__r33 = { mockStore, events, calendar };
    window.__r33Scrolls = [];
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) { window.__r33Scrolls.push(this.className); scroll.call(this, options); };
    await import('/src/main.jsx');
  `;
  const server = await createServer({ configFile: false, envDir: false,
    define: { 'import.meta.env.VITE_USE_MOCK': '"true"', 'import.meta.env.VITE_PLANNER_USE_MOCK': '"true"' },
    plugins: [{ name: 'r33-app-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__r33.jsx') return '\0r33.jsx'; },
      load(id) { if (id === '\0r33.jsx') return entry; },
      configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
        if (!/^\/(schedules|calendar)(\/|\?|$)/.test(req.url)) return next();
        try {
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__r33.jsx"></script></body></html>'));
        } catch (error) { next(error); }
      }); },
    }, react()], server: { host: '127.0.0.1', port: 0, ws: false },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-router-dom'] },
  });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ executablePath: process.env.R33_CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox'] });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const run = (name, path, action) => t.test(name, async () => {
      const page = await browser.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      try {
        await page.goto(origin + path); await page.getByRole('textbox', { name: '공지 검색' }).waitFor();
        await page.waitForFunction(() => document.querySelector('.notice-list .event-row'));
        await action(page); assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await run('대표 2건·상세 3건·알림 대상의 독립 상태와 필터 해제·포커스·스크롤',
      '/schedules?q=없는검색어&cat=career&src=wevity&open=102', async page => {
        const row = page.locator('[aria-controls="notices-100-detail"]');
        await page.locator('#notices-100-detail [aria-current="true"]').waitFor();
        assert.equal(await page.locator('.notice-list .event-row').count(), 2);
        assert.equal(await page.locator('#notices-100-detail .event-timeline-item').count(), 3);
        assert.match(await page.locator('#notices-100-detail [aria-current="true"]').innerText(), /면접[\s\S]*알림 대상 · 미등록/);
        assert.equal(await page.locator('#notices-100-detail').getByRole('button', { name: '일정 등록', exact: true }).count(), 1);
        assert.equal(await row.evaluate(e => document.activeElement === e), true);
        assert.ok(await page.evaluate(() => window.__r33Scrolls.some(value => value.includes('event-row'))));
        assert.equal(await page.getByRole('textbox', { name: '공지 검색' }).inputValue(), '');
        assert.equal(new URL(page.url()).search, '');
      });
    await run('마감된 공지는 목록에서 제외되어도 비대표 등록 일정 알림을 읽기 전용으로 표시',
      '/schedules?closed=1&open=101', async page => {
        const panel = page.getByRole('region', { name: '알림 대상 공지' }); await panel.waitFor();
        assert.equal(await page.locator('.notice-list .event-row').count(), 1);
        assert.match(await panel.locator('[aria-current="true"]').innerText(), /본행사[\s\S]*알림 대상 · 등록됨 · 완료/);
        assert.equal(await panel.getByRole('button', { name: '일정 등록' }).count(), 0);
        assert.equal(await panel.evaluate(e => document.activeElement === e), true);
        assert.deepEqual(await page.evaluate(async () => (await window.__r33.calendar.getRegisteredEvents()).map(e => e.id)), ['101']);
      });
    await run('실제 알림 패널의 비대표 알림 클릭은 읽음 처리 후 대표 공지를 펼친다', '/schedules', async page => {
      await page.getByRole('button', { name: /알림/ }).first().click();
      await page.getByRole('button', { name: /면접 알림/ }).click();
      await page.locator('#notices-100-detail [aria-current="true"]').waitFor();
      assert.equal(await page.evaluate(() => window.__r33.mockStore.notifications[0].read), true);
      assert.equal(await page.getByRole('region', { name: '알림함' }).count(), 0);
    });
    await run('공지 숨김·복원은 대표 하나에 반영되고 등록 일정은 유지', '/schedules', async page => {
      await page.locator('[aria-controls="notices-100-detail"]').click();
      await page.locator('#notices-100-detail').getByRole('button', { name: '관심 없음', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.notice-list .event-row').length === 1);
      assert.deepEqual(await page.evaluate(async () => (await window.__r33.calendar.getRegisteredEvents()).map(e => e.id)), ['101']);
      await page.getByRole('link', { name: /숨긴 공지/ }).click();
      await page.getByRole('button', { name: '숨김 해제', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.notice-list .event-row'));
      assert.deepEqual(await page.evaluate(async () => (await window.__r33.events.getEvents()).map(e => e.id)), ['100', '200']);
    });
    await run('관심 저장·묶음 등록·등록 해제와 면접 분리를 유지', '/schedules', async page => {
      await page.locator('[aria-controls="notices-100-detail"]').click();
      const detail = page.locator('#notices-100-detail');
      await detail.getByRole('button', { name: '관심 저장', exact: true }).click();
      await detail.getByRole('button', { name: '저장됨', exact: true }).waitFor();
      assert.ok(await page.evaluate(() => window.__r33.mockStore.events.filter(e => e.notice_id === 10).every(e => e.bookmarked)));
      await detail.getByRole('button', { name: '일정 등록', exact: true }).click();
      await detail.getByRole('button', { name: '등록 해제', exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(async () => (await window.__r33.calendar.getRegisteredEvents()).map(e => e.id)), ['100', '101']);
      await detail.getByRole('button', { name: '등록 해제', exact: true }).click();
      await detail.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.__r33.mockStore.events.filter(e => e.registered).map(e => e.id)), []);
    });
    await run('실제 Chromium IME 조합과 250ms URL 디바운스·삭제를 유지', '/schedules', async page => {
      const input = page.getByRole('textbox', { name: '공지 검색' });
      const cdp = await page.context().newCDPSession(page); await input.focus();
      await cdp.send('Input.imeSetComposition', { text: '장', selectionStart: 1, selectionEnd: 1 });
      await page.waitForTimeout(350); assert.equal(new URL(page.url()).searchParams.has('q'), false);
      await cdp.send('Input.insertText', { text: '장학' });
      await page.waitForURL(url => url.searchParams.get('q') === '장학');
      assert.equal(await page.locator('.notice-list .event-row').count(), 1);
      await page.getByRole('button', { name: '검색어 지우기' }).click();
      await page.waitForTimeout(350); assert.equal(new URL(page.url()).searchParams.has('q'), false);
      assert.equal(await page.locator('.notice-list .event-row').count(), 2);
    });
  } finally { await browser?.close(); await server.close(); }
});
