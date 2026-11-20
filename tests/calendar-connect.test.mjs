import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { CALENDAR_PENDING_KEY, calendarConnectUrl, calendarReturnPath, savePendingRegistrations, takePendingRegistrations } from '../src/utils/calendarConnect.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
}

test('돌아올 주소에서 이전 연결 결과를 지운다', () => {
  assert.equal(calendarReturnPath('/schedules', '?tab=all&calendar=denied'), '/schedules?tab=all');
  assert.equal(calendarReturnPath('/planner', ''), '/planner');
  assert.equal(calendarConnectUrl('', '/schedules', '?tab=all'), '/api/auth/google/calendar?next=%2Fschedules%3Ftab%3Dall');
  assert.equal(calendarConnectUrl('https://api.example/', '/x', ''), 'https://api.example/api/auth/google/calendar?next=%2Fx');
});

test('보관한 등록 요청은 같은 계정·30분 안에서 한 번만 꺼낸다', () => {
  const storage = memoryStorage();
  savePendingRegistrations(storage, 'a@x', [{ id: 7, interview: true, successMessage: '등록했어요', extra: 'drop' }], 1000);
  assert.deepEqual(takePendingRegistrations(storage, 'a@x', 2000), [{ id: '7', interview: true, editing: false, successMessage: '등록했어요' }]);
  assert.deepEqual(takePendingRegistrations(storage, 'a@x', 2000), []);
  savePendingRegistrations(storage, 'a@x', [{ id: '1' }], 1000);
  assert.deepEqual(takePendingRegistrations(storage, 'b@x', 2000), []);
  assert.equal(storage.data.has(CALENDAR_PENDING_KEY), false);
  savePendingRegistrations(storage, 'a@x', [{ id: '1' }], 0);
  assert.deepEqual(takePendingRegistrations(storage, 'a@x', 31 * 60 * 1000), []);
  storage.setItem(CALENDAR_PENDING_KEY, '{broken');
  assert.deepEqual(takePendingRegistrations(storage, 'a@x'), []);
});

const playwright = await import(process.env.R05_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('캘린더 미연결 사용자: 안내 창 → Google 이동 → 돌아오면 이어서 등록', {
  skip: !playwright && 'Playwright 미설치: R05_PLAYWRIGHT_MODULE을 지정하세요.', timeout: 120_000,
}, async (t) => {
  const services = `
    const copy = value => structuredClone(value);
    const remote = [{ id: 'n', notice_id: 30, title: '공지', event_type: 'application', review_required: false, review_status: 'auto',
      source: 'cbnu', category: 'career', start_date: '2026-12-20', end_date: '2026-12-21', registered: false, bookmarked: true, can_register: true }];
    window.__writes = [];
    export const getEvents = async () => copy(remote);
    export const getEventDetail = async () => ({ notice_id: 30, events: copy(remote) });
    export const registerEvent = async (id) => { window.__writes.push(id); remote[0].registered = true; };
    export const registerInterview = async (id) => { window.__writes.push(id); };
    export const getRegisteredEvents = async () => copy(remote.filter(e => e.registered));
    export const getDashboardSummary = async () => ({});
  `;
  const entry = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { AppDataProvider, useAppData } from '/src/context/AppDataContext.jsx';
    import '/__cc-services.js';
    function Harness() {
      const { requestRegistration, actionError, status } = useAppData();
      return React.createElement('main', null,
        React.createElement('p', { id: 'status' }, status),
        React.createElement('button', { id: 'reg', onClick: () => requestRegistration('n') }, '일정 등록'),
        actionError && React.createElement('p', { id: 'err' }, actionError.message));
    }
    createRoot(document.getElementById('root')).render(React.createElement(AppDataProvider, null, React.createElement(Harness)));
  `;
  const server = await createServer({ configFile: false, envDir: false,
    plugins: [{ name: 'cc-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__cc.jsx') return '\0cc.jsx'; if (id === '/__cc-services.js') return '\0cc-services.js'; },
      load(id) {
        const path = id.replaceAll('\\', '/');
        if (id === '\0cc.jsx') return entry;
        if (id === '\0cc-services.js') return services;
        if (path.endsWith('/src/context/UserContext.jsx'))
          return 'export function useUser() { return { profile: { email: "cc@example.test", calendar_connected: !!window.__connected }, preferences: { enabled_sources: {} }, sourcesVersion: 0, plannerSourceKey: "s" }; }';
        if (/\/src\/services\/(event|calendar|dashboard)Service\.js$/.test(path)) return 'export * from "/__cc-services.js";';
      },
      configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/page')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml(req.url, '<html><body><div id="root"></div><script type="module" src="/__cc.jsx"></script></body></html>'));
      }); },
    }, react()], server: { host: '127.0.0.1', port: 0, ws: false },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client'] },
  });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ executablePath: process.env.R05_CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox'] });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

    await t.test('미연결이면 등록하지 않고 안내 창을 연 뒤 Google 연결 주소로 이동한다', async () => {
      const page = await browser.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let connectUrl = null;
      await page.route('**/api/auth/google/calendar**', route => { connectUrl = route.request().url(); route.fulfill({ status: 200, body: 'ok' }); });
      await page.goto(origin + '/page?tab=all');
      await page.waitForSelector('#status:text("ready")');
      await page.click('#reg');
      const dialog = page.getByRole('dialog', { name: 'Google 캘린더를 연결할게요' });
      await dialog.waitFor();
      assert.equal(await dialog.getByText('졸업작품').count(), 0);
      assert.deepEqual(await page.evaluate(() => window.__writes), []);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      await page.click('#reg');
      await page.getByRole('button', { name: 'Google 캘린더 연결' }).click();
      await page.waitForURL('**/api/auth/google/calendar**');
      assert.equal(new URL(connectUrl).searchParams.get('next'), '/page?tab=all');
      await page.goto(origin + '/page');
      const pending = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), CALENDAR_PENDING_KEY);
      assert.equal(pending.email, 'cc@example.test');
      assert.deepEqual(pending.requests.map(r => r.id), ['n']);
      assert.deepEqual(errors, []);
      await page.close();
    });

    await t.test('연결되어 돌아오면 보관한 등록을 이어서 하고 주소의 결과 표시를 지운다', async () => {
      const page = await browser.newPage();
      await page.addInitScript(key => {
        window.__connected = true;
        sessionStorage.setItem(key, JSON.stringify({ email: 'cc@example.test', at: Date.now(), requests: [{ id: 'n', interview: false, editing: false }] }));
      }, CALENDAR_PENDING_KEY);
      await page.goto(origin + '/page?tab=all&calendar=connected');
      await page.waitForFunction(() => window.__writes.length === 1);
      assert.deepEqual(await page.evaluate(() => window.__writes), ['n']);
      assert.equal(new URL(page.url()).search, '?tab=all');
      await page.close();
    });

    await t.test('거절하고 돌아오면 등록하지 않고 안내만 보여준다', async () => {
      const page = await browser.newPage();
      await page.addInitScript(key => {
        sessionStorage.setItem(key, JSON.stringify({ email: 'cc@example.test', at: Date.now(), requests: [{ id: 'n' }] }));
      }, CALENDAR_PENDING_KEY);
      await page.goto(origin + '/page?calendar=denied');
      await page.waitForSelector('#err');
      assert.match(await page.textContent('#err'), /캘린더 연결을 취소/);
      assert.deepEqual(await page.evaluate(() => window.__writes), []);
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), CALENDAR_PENDING_KEY), null);
      await page.close();
    });
  } finally {
    await browser?.close();
    await server.close();
  }
});
