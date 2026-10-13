import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const playwright = await import(process.env.R04_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);
const event = (id, notice_id, patch = {}) => ({ id, notice_id, title: notice_id === 10 ? '장학 공지' : '취업 공지',
  source: notice_id === 10 ? 'cbnu' : 'wevity', category: notice_id === 10 ? 'scholarship' : 'career',
  event_type: 'application', review_status: 'auto', can_register: true, registered: false, bookmarked: false,
  dismissed: false, action_status: 'pending', end_date: '2026-12-20', ...patch });
const representatives = [event('100', 10, { registered: true, bookmarked: true, action_status: 'done' }), event('200', 20)];
const groups = {
  '100': { notice_id: 10, dismissed: false, events: [representatives[0], event('101', 10, { event_type: 'interview', start_date: '2026-12-21', end_date: '2026-12-21' }), event('102', 10, { event_type: 'event', registered: true, action_status: 'done' })] },
  '200': { notice_id: 20, dismissed: false, events: [representatives[1], event('201', 20, { event_type: 'event' })] },
  '900': { notice_id: 90, dismissed: true, events: [event('900', 90, { title: '숨긴 공지', dismissed: true, registered: true })] },
  '800': { notice_id: 80, dismissed: false, events: [event('800', 80, { title: '목록 밖 공지' })] },
};
groups['101'] = groups['100']; groups['102'] = groups['100']; groups['201'] = groups['200'];

test('R04 실제 API 정규화·React DOM·알림 패널 딥링크 회귀', {
  skip: !playwright && 'Playwright 미설치: R04_PLAYWRIGHT_MODULE을 지정하세요.', timeout: 120_000,
}, async (t) => {
  const fixture = `
    import { useSyncExternalStore } from 'react';
    import { normalizeEvent } from '/src/services/eventService.js';
    window.__r04Actions = [];
    const action = name => async (...args) => { window.__r04Actions.push([name, ...args]); return true; };
    let data = { events: ${JSON.stringify(representatives)}.map(normalizeEvent), calendarEvents: [], hiddenEvents: [],
      status: new URLSearchParams(location.search).has('loading') ? 'loading' : 'ready', summary: {}, actionBusy: false,
      requestRegistration: action('register'), unregisterDetailEvent: action('unregister'), saveBookmark: action('bookmark'),
      setDismissed: action('dismiss'), setActionStatus: action('status'), syncEvent: action('sync'), showUndo() {} };
    const listeners = new Set();
    window.__r04SetData = patch => { data = { ...data, ...patch, events: (patch.events || data.events).map(normalizeEvent) }; listeners.forEach(fn => fn()); };
    export function useAppData() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => data); }
  `;
  const entry = `
    import React, { StrictMode, Suspense, useLayoutEffect, useRef, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
    import SchedulesPage from '/src/pages/SchedulesPage.jsx';
    import NotificationPanel from '/src/components/NotificationPanel.jsx';
    function Gate({ children }) { const location = useLocation(); if (window.__r04Hold?.search === location.search) throw window.__r04Hold.promise; return children; }
    function App() {
      const navigate = useNavigate(), location = useLocation(), containerRef = useRef(null);
      const [panel, setPanel] = useState(false);
      useLayoutEffect(() => { window.__r04Navigate = navigate; window.__r04LocationKey = location.key; });
      return React.createElement(React.Fragment, null,
        React.createElement('div', { ref: containerRef }, React.createElement('button', { onClick: () => setPanel(true) }, '알림 열기'),
          panel && React.createElement(NotificationPanel, { containerRef, onClose: () => setPanel(false), onCountChange() {}, unreadCount: 1, id: 'notifications' })),
        React.createElement('div', { style: { height: 1200 }, 'aria-hidden': true }),
        React.createElement(Suspense, { fallback: React.createElement('p', null, '탐색 대기') }, React.createElement(Gate, null,
          React.createElement(Routes, null, React.createElement(Route, { path: '/schedules', element: React.createElement(SchedulesPage) }),
            React.createElement(Route, { path: '/away', element: React.createElement('p', null, '다른 페이지') })))));
    }
    createRoot(document.getElementById('root')).render(React.createElement(StrictMode, null, React.createElement(BrowserRouter, null, React.createElement(App))));
  `;
  const server = await createServer({ configFile: false, envDir: false,
    define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' },
    plugins: [{ name: 'r04-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__r04.jsx') return '\0r04.jsx'; },
      load(id) { if (id === '\0r04.jsx') return entry; if (id.replaceAll('\\', '/').endsWith('/src/context/AppDataContext.jsx')) return fixture; },
      configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
        if (!/^\/(schedules|away)(\?|$)/.test(req.url)) return next();
        try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.url,
          '<html><body><div id="root"></div><script type="module" src="/__r04.jsx"></script></body></html>')); } catch (error) { next(error); }
      }); },
    }, react()], server: { host: '127.0.0.1', port: 0, ws: false },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-router-dom'] },
  });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ executablePath: process.env.R04_CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox'] });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const run = (name, action, url = '/schedules', initialHolds = []) => t.test(name, async () => {
      const page = await browser.newPage(), calls = [], errors = [], held = new Set(initialHolds), pending = [], overrides = new Map();
      let readFailure = false;
      page.on('pageerror', error => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        window.__r04Scrolls = [];
        const original = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function(options) { window.__r04Scrolls.push(options); original.call(this, options); };
      });
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname; calls.push({ path, method: route.request().method() });
        if (path.startsWith('/api/events/')) {
          const id = decodeURIComponent(path.slice('/api/events/'.length));
          if (held.has(id)) await new Promise(resolve => pending.push({ id, resolve }));
          const response = overrides.get(id) || (groups[id] ? { status: 200, body: groups[id] } : { status: 404, body: { detail: '없음' } });
          await route.fulfill({ status: response.status, json: response.body });
        } else if (path === '/api/notifications') {
          await route.fulfill({ json: { items: [{ id: 'n1', event_id: '101', title: '면접 알림', message: '면접을 확인하세요', read: false, created_at: '2026-10-14T00:00:00Z' }], next_before: null } });
        } else { await route.fulfill({ status: readFailure ? 503 : 200, json: { read: true } }); }
      });
      try {
        await page.goto(origin + url); await page.getByRole('textbox', { name: '공지 검색' }).waitFor();
        const navigate = async to => {
          await page.evaluate(to => window.__r04Navigate(to), to);
          await page.waitForFunction(() => window.__r04LocationKey === history.state.key);
        };
        const release = id => { held.delete(id); pending.filter(p => p.id === id).forEach(p => p.resolve()); };
        const waitCall = async id => {
          for (let i = 0; i < 100; i++) { if (calls.some(c => c.path === '/api/events/' + encodeURIComponent(id))) return; await delay(10); }
          assert.fail('상세 API 호출 없음: ' + id);
        };
        const expanded = async title => {
          const row = page.locator('.event-row').filter({ hasText: title });
          await page.waitForFunction(title => [...document.querySelectorAll('.event-row')].some(e => e.textContent.includes(title) && e.getAttribute('aria-expanded') === 'true'), title);
          return row;
        };
        const params = () => new URL(page.url()).searchParams;
        await action({ page, calls, held, overrides, navigate, release, waitCall, expanded, params, failRead: value => { readFailure = value; } });
        assert.deepEqual(errors, []);
      } finally { held.clear(); pending.forEach(p => p.resolve()); await page.close(); }
    });

    await run('목록 대상은 기존 행을 펼치고 포커스와 실제 스크롤을 이동한다', async ({ page, expanded, calls, params }) => {
      const row = await expanded('장학 공지');
      assert.equal(await row.evaluate(e => document.activeElement === e), true);
      assert.ok(await page.evaluate(() => scrollY > 0 && window.__r04Scrolls.some(o => o.block === 'center')));
      assert.equal(params().has('open'), false);
      assert.equal(calls.some(c => c.path === '/api/events/101'), false);
    }, '/schedules?open=100');
    await run('비대표 면접은 같은 공지의 대표 행을 열고 실제 대상과 상태를 표시한다', async ({ page, expanded, params }) => {
      await expanded('장학 공지'); await page.locator('.event-timeline-item[aria-current="true"]').waitFor();
      const target = page.locator('.event-timeline-item[aria-current="true"]');
      assert.match(await target.innerText(), /면접.*알림 대상 · 미등록/s);
      assert.doesNotMatch(await target.innerText(), /완료|알림 대상 · 등록됨/);
      assert.equal(await page.locator('.event-timeline-item.is-current').count(), 1);
      await target.getByRole('button', { name: '캘린더에 따로 추가', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.__r04Actions), [['register', '101', true]]);
      assert.equal(params().has('open'), false);
    }, '/schedules?open=101');
    await run('여러 일정 중 완료된 실제 대상 하나에만 알림 표시를 붙인다', async ({ page, expanded }) => {
      await expanded('장학 공지'); await page.locator('.event-timeline-item[aria-current="true"]').waitFor();
      assert.match(await page.locator('.event-timeline-item[aria-current="true"]').innerText(), /본행사.*알림 대상 · 등록됨 · 완료/s);
      assert.equal(await page.locator('.event-timeline-item[aria-current="true"]').count(), 1);
    }, '/schedules?open=102');
    await run('대표 행의 후속 상세에서 대상이 사라지면 다른 일정으로 표시하지 않고 안내한다', async ({ page, overrides, navigate, expanded }) => {
      overrides.set('100', { status: 200, body: { notice_id: 10, events: [representatives[0]] } });
      await navigate('/schedules?open=101'); await expanded('장학 공지');
      await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /알림 대상 일정은 현재 상세에서 확인할 수 없어요/);
      assert.equal(await page.locator('.event-timeline-item[aria-current="true"]').count(), 0);
    });
    await run('상세의 notice_id 관계로 연결하되 실제 대상이 없는 응답은 다른 행을 열지 않는다', async ({ page, overrides, navigate, expanded }) => {
      overrides.set('101', { status: 200, body: { notice_id: 10, events: [event('101', 10)] } });
      await navigate('/schedules?open=101'); await expanded('장학 공지');
      overrides.set('missing', { status: 200, body: groups['100'] });
      await navigate('/schedules?open=missing'); await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('.event-row[aria-expanded="true"]').count(), 0);
    });
    await run('검색·분야·출처에 가려진 대표 행을 표시하고 이전 검색을 되살리지 않는다', async ({ page, held, navigate, waitCall, release, expanded, params }) => {
      held.add('101'); await navigate('/schedules?open=101&q=%EC%B7%A8%EC%97%85&cat=career&src=wevity&extra=keep');
      await waitCall('101'); await page.getByRole('textbox', { name: '공지 검색' }).fill('숨기는 검색');
      release('101'); await expanded('장학 공지'); await delay(350);
      assert.equal(await page.getByRole('textbox', { name: '공지 검색' }).inputValue(), '');
      for (const key of ['q', 'cat', 'src', 'open']) assert.equal(params().has(key), false);
      assert.equal(params().get('extra'), 'keep');
    });
    await run('상세 대기 중 변경한 최신 분야·출처를 기준으로 필터를 해제한다', async ({ page, waitCall, release, expanded, params }) => {
      await waitCall('101'); await page.getByRole('button', { name: '진로·취업', exact: true }).click();
      await page.getByRole('combobox', { name: '출처' }).selectOption('wevity');
      release('101'); await expanded('장학 공지');
      assert.equal(params().has('cat'), false); assert.equal(params().has('src'), false);
    }, '/schedules?open=101', ['101']);
    await run('로딩 중 직접 진입은 ready 이후에 상세 조회와 펼침을 진행한다', async ({ page, calls, expanded }) => {
      assert.equal(calls.some(c => c.path === '/api/events/101'), false);
      await page.evaluate(() => window.__r04SetData({ status: 'ready' })); await expanded('장학 공지');
    }, '/schedules?loading=1&open=101');
    await run('숨김 공지는 상태를 변경하거나 정상 목록에 삽입하지 않고 읽기 전용 상세로 보여준다', async ({ page, params }) => {
      const panel = page.getByRole('region', { name: '알림 대상 공지' }); await panel.waitFor();
      assert.match(await panel.innerText(), /숨긴 공지예요/);
      assert.equal(await panel.evaluate(e => document.activeElement === e), true);
      assert.equal(await page.locator('.event-row').count(), 2);
      assert.equal(await panel.getByRole('button', { name: /등록|수정|관심 저장/ }).count(), 0);
      assert.deepEqual(await page.evaluate(() => window.__r04Actions), []);
      assert.equal(params().has('open'), false);
    }, '/schedules?open=900');
    await run('대표 행이 없는 공개 일정도 별도 상세에만 표시하고 검색과 필터를 유지한다', async ({ page, params }) => {
      await page.getByRole('region', { name: '알림 대상 공지' }).waitFor();
      assert.equal(await page.locator('.event-row').count(), 1);
      assert.equal(params().get('q'), '취업'); assert.equal(params().get('cat'), 'career');
      await page.getByRole('button', { name: '알림 공지 닫기' }).click();
      assert.equal(await page.getByRole('region', { name: '알림 대상 공지' }).count(), 0);
    }, '/schedules?open=800&q=%EC%B7%A8%EC%97%85&cat=career');
    await run('404와 조회 오류는 안내하고 open을 소비하며 재시도할 수 있다', async ({ page, overrides, navigate, params }) => {
      await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /삭제되었거나 공개되지/);
      assert.equal(params().has('open'), false); assert.equal(params().get('q'), '취업');
      overrides.set('999', { status: 200, body: { notice_id: 99, events: [event('999', 99)] } });
      await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await page.getByRole('region', { name: '알림 대상 공지' }).waitFor();
      overrides.set('failure', { status: 503, body: {} }); await navigate('/schedules?open=failure');
      await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /불러오지 못했어요/);
    }, '/schedules?open=999&q=%EC%B7%A8%EC%97%85');
    await run('상세 대기 중 유지한 검색은 처리 후 URL 동기화를 재개한다', async ({ page, waitCall, release, expanded, params }) => {
      await waitCall('101'); await page.getByRole('textbox', { name: '공지 검색' }).fill('장학');
      assert.equal(params().has('q'), false); release('101'); await expanded('장학 공지'); await delay(350);
      assert.equal(params().get('q'), '장학');
    }, '/schedules?open=101', ['101']);
    await run('IME 미완료 조합은 상세 처리 뒤에도 URL에 쓰지 않고 확정 후 동기화한다', async ({ page, waitCall, release, expanded, params }) => {
      await waitCall('101');
      await page.evaluate(() => {
        const input = document.querySelector('input[aria-label="공지 검색"]');
        input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '장');
        input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      });
      release('101'); await expanded('장학 공지'); await delay(350); assert.equal(params().has('q'), false);
      await page.evaluate(() => document.querySelector('input[aria-label="공지 검색"]').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
      await delay(350); assert.equal(params().get('q'), '장');
    }, '/schedules?open=101', ['101']);
    await run('빠른 두 알림에서 늦은 이전 상세 응답은 다른 공지를 열지 않는다', async ({ page, navigate, waitCall, release, expanded }) => {
      await waitCall('101'); await navigate('/schedules?open=201'); await waitCall('201');
      release('201'); await expanded('취업 공지'); release('101'); await delay(150);
      assert.equal(await page.locator('.event-row').filter({ hasText: '장학 공지' }).getAttribute('aria-expanded'), 'false');
    }, '/schedules?open=101', ['101', '201']);
    await run('이전 요청 실패도 새 알림의 성공을 오류로 덮어쓰지 않는다', async ({ page, overrides, navigate, waitCall, release, expanded }) => {
      await waitCall('101'); overrides.set('101', { status: 503, body: {} });
      await navigate('/schedules?open=201'); await expanded('취업 공지'); release('101'); await delay(150);
      assert.equal(await page.getByRole('alert').count(), 0);
    }, '/schedules?open=101', ['101']);
    await run('페이지 이탈 후 상세 응답은 공지 화면으로 돌아오거나 대상 공지를 열지 않는다', async ({ page, navigate, waitCall, release }) => {
      await waitCall('101'); await navigate('/away'); release('101'); await delay(150);
      assert.equal(new URL(page.url()).pathname, '/away'); assert.equal(await page.locator('.event-row').count(), 0);
    }, '/schedules?open=101', ['101']);
    await run('외부 탐색 commit 전 도착한 이전 상세는 새 URL을 덮어쓰지 않는다', async ({ page, waitCall, release, expanded, params }) => {
      await waitCall('101');
      await page.evaluate(() => {
        let release; const promise = new Promise(resolve => { release = resolve; });
        window.__r04Hold = { search: '?open=201', promise, release }; window.__r04Navigate('/schedules?open=201');
      });
      release('101'); await delay(150); assert.equal(params().get('open'), '201');
      await page.evaluate(() => { const hold = window.__r04Hold; window.__r04Hold = null; hold.release(); });
      await expanded('취업 공지');
    }, '/schedules?open=101', ['101']);
    await run('데이터 재로딩과 상세 응답이 겹쳐도 ready 이후 대상 표시를 완료한다', async ({ page, waitCall, release, expanded, params }) => {
      await waitCall('101'); await page.evaluate(() => window.__r04SetData({ status: 'loading' }));
      release('101'); await delay(150); assert.equal(params().get('open'), '101');
      await page.evaluate(() => window.__r04SetData({ status: 'ready' })); await expanded('장학 공지');
    }, '/schedules?open=101', ['101']);
    await run('실제 알림 패널의 읽음 성공 후 비대표 ID로 이동하고 패널을 닫는다', async ({ page, calls, expanded }) => {
      await page.getByRole('button', { name: '알림 열기' }).click();
      await page.getByRole('button', { name: /면접 알림/ }).click(); await expanded('장학 공지');
      assert.ok(calls.some(c => c.path === '/api/notifications/n1/read' && c.method === 'POST'));
      assert.equal(await page.getByRole('region', { name: '알림함' }).count(), 0);
    });
    await run('읽음 실패 시 알림 패널과 현재 URL을 유지한다', async ({ page, failRead, params }) => {
      failRead(true); await page.getByRole('button', { name: '알림 열기' }).click();
      await page.getByRole('button', { name: /면접 알림/ }).click(); await page.getByRole('alert').waitFor();
      assert.equal(params().has('open'), false); assert.equal(await page.getByRole('region', { name: '알림함' }).count(), 1);
    });
  } finally { await browser?.close(); await server.close(); }
});
