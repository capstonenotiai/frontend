import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const playwright = await import(process.env.R05_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('R05 확인창 키보드·배경 차단·실제 등록 큐 Chromium 회귀', {
  skip: !playwright && 'Playwright 미설치: R05_PLAYWRIGHT_MODULE을 지정하세요.', timeout: 120_000,
}, async (t) => {
  const services = `
    const copy = value => structuredClone(value);
    const event = (id, notice_id, event_type = 'application', review_required = true) => ({ id, notice_id, title: id + ' 공지',
      event_type, review_required, review_reason: review_required ? '원문 확인' : '', review_status: 'auto',
      source: 'cbnu', category: 'career', start_date: '2026-12-20', end_date: '2026-12-21', start_time: '09:00', end_time: '18:00',
      location: '원래 장소', registered: false, bookmarked: true, can_register: true });
    window.__r05Remote = [event('a', 10), event('a2', 10, 'event', false), event('a3', 10, 'interview'), event('b', 20), event('n', 30, 'application', false)];
    window.__r05Reads = []; window.__r05Writes = []; window.__r05Held = new Set(); window.__r05Pending = [];
    window.__r05Release = id => { window.__r05Held.delete(id); window.__r05Pending.filter(p => p.id === id).forEach(p => p.resolve()); };
    export const getEvents = async () => copy(window.__r05Remote.filter(e => ['a', 'b', 'n'].includes(e.id)));
    export const getEventDetail = async id => {
      window.__r05Reads.push(id);
      if (window.__r05Held.has(id)) await new Promise(resolve => window.__r05Pending.push({ id, resolve }));
      if (window.__r05FailDetail === id) throw new Error('상세 조회 실패');
      const anchor = window.__r05Remote.find(e => e.id === id);
      return { notice_id: anchor.notice_id, events: copy(window.__r05Remote.filter(e => e.notice_id === anchor.notice_id)) };
    };
    const register = async (id, overrides = {}, confirmed = false, interview = false) => {
      window.__r05Writes.push({ id, overrides: copy(overrides), confirmed, interview });
      if (window.__r05HoldWrite) await new Promise(resolve => { window.__r05FinishWrite = resolve; });
      if (window.__r05FailWrite) throw new Error('등록 실패');
      const anchor = window.__r05Remote.find(e => e.id === id);
      for (const item of window.__r05Remote.filter(e => interview ? e.id === id : e.notice_id === anchor.notice_id && e.event_type !== 'interview')) {
        Object.assign(item, overrides[item.id] || {}, { registered: true });
      }
    };
    export const registerEvent = (id, overrides, confirmed) => register(id, overrides, confirmed);
    export const registerInterview = (id, overrides, confirmed) => register(id, overrides, confirmed, true);
    export const getRegisteredEvents = async () => copy(window.__r05Remote.filter(e => e.registered));
    export const getDashboardSummary = async () => ({});
  `;
  const entry = `
    import React, { StrictMode, useLayoutEffect, useRef, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { AppDataProvider, useAppData } from '/src/context/AppDataContext.jsx';
    import RegisterConfirmDialog from '/src/components/RegisterConfirmDialog.jsx';
    import '/__r05-services.js';
    function Background({ children }) { return React.createElement('main', { id: 'main' },
      React.createElement('h1', null, '배경 화면'), React.createElement('input', { 'aria-label': '배경 입력' }), children); }
    function Direct() {
      const [request, setRequest] = useState(null), [busy, setBusy] = useState(false), [gone, setGone] = useState(false);
      const triggerRef = useRef(null);
      useLayoutEffect(() => { window.__r05SetRequest = setRequest; window.__r05SetBusy = setBusy; window.__r05RemoveTrigger = () => setGone(true); });
      const open = editing => setRequest({ id: 'a', interview: false, editing });
      const confirm = async changes => {
        window.__r05DirectCalls ||= []; window.__r05DirectCalls.push(changes);
        const ok = window.__r05HoldConfirm ? await new Promise(resolve => { window.__r05FinishConfirm = resolve; }) : true;
        if (window.__r05ThrowConfirm) throw new Error('등록 오류');
        if (ok && !window.__r05KeepOpen) setRequest(null);
        return ok;
      };
      return React.createElement(React.Fragment, null, React.createElement(Background, null,
        !gone && React.createElement('button', { ref: triggerRef, onClick: () => open(false) }, '직접 등록'),
        React.createElement('button', { onClick: () => open(true) }, '직접 수정')),
        request && React.createElement(RegisterConfirmDialog, { request, busy, triggerRef, onCancel: () => { window.__r05Cancels = (window.__r05Cancels || 0) + 1; setRequest(null); }, onConfirm: confirm }));
    }
    function ProviderHarness() {
      const app = useAppData();
      useLayoutEffect(() => { window.__r05App = app; });
      return React.createElement(Background, null,
        React.createElement('button', { disabled: app.actionBusy || app.status !== 'ready', onClick: () => app.requestRegistration('a') }, '묶음 등록'),
        React.createElement('button', { disabled: app.actionBusy || app.status !== 'ready', onClick: () => app.requestRegistration('a', false, true) }, '일정 수정'),
        React.createElement('button', { disabled: app.actionBusy || app.status !== 'ready', onClick: () => app.requestRegistration('a3', true) }, '면접 등록'),
        React.createElement('button', { disabled: app.actionBusy || app.status !== 'ready', onClick: app.registerAll }, '전체 등록'),
        app.actionError && React.createElement('p', { role: 'alert' }, app.actionError.message));
    }
    const direct = new URLSearchParams(location.search).has('direct');
    createRoot(document.getElementById('root')).render(React.createElement(StrictMode, null, direct ? React.createElement(Direct)
      : React.createElement(AppDataProvider, null, React.createElement(ProviderHarness))));
  `;
  const server = await createServer({ configFile: false, envDir: false,
    plugins: [{ name: 'r05-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__r05.jsx') return '\0r05.jsx'; if (id === '/__r05-services.js') return '\0r05-services.js'; },
      load(id) {
        const path = id.replaceAll('\\', '/');
        if (id === '\0r05.jsx') return entry;
        if (id === '\0r05-services.js') return services;
        if (path.endsWith('/src/context/UserContext.jsx')) return 'export function useUser() { return { profile: { email: "r05@example.test" }, preferences: { enabled_sources: {} }, sourcesVersion: 0, plannerSourceKey: "sources" }; }';
        if (/\/src\/services\/(event|calendar|dashboard)Service\.js$/.test(path)) return 'export * from "/__r05-services.js";';
      },
      configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/dialog')) return next();
        try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.url,
          '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__r05.jsx"></script></body></html>')); } catch (error) { next(error); }
      }); },
    }, react()], server: { host: '127.0.0.1', port: 0, ws: false },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client'] },
  });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ executablePath: process.env.R05_CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox'] });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const run = (name, action, direct = true) => t.test(name, async () => {
      const page = await browser.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(origin + '/dialog' + (direct ? '?direct=1' : ''));
        await page.getByRole('heading', { name: '배경 화면' }).waitFor();
        if (!direct) await page.waitForFunction(() => window.__r05App?.status === 'ready');
        const open = async (name = direct ? '직접 등록' : '묶음 등록') => {
          await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('dialog').waitFor();
        };
        const inside = async () => assert.equal(await page.evaluate(() => document.querySelector('.confirm-dialog')?.contains(document.activeElement)), true);
        const loaded = () => page.getByRole('dialog').getByRole('textbox', { name: '장소', exact: true }).first().waitFor();
        const close = () => page.waitForFunction(() => !document.querySelector('.confirm-dialog'));
        await action({ page, open, inside, loaded, close });
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await run('열기 시 제목에 포커스하고 모달을 제외한 배경을 키보드·접근성 트리에서 차단한다', async ({ page, open }) => {
      await open();
      assert.equal(await page.getByRole('dialog').getByRole('heading').evaluate(e => document.activeElement === e), true);
      assert.equal(await page.locator('#root').getAttribute('inert'), '');
      assert.equal(await page.locator('#root').getAttribute('aria-hidden'), 'true');
      assert.equal(await page.getByRole('button', { name: '직접 등록', exact: true }).count(), 0);
      assert.equal(await page.getByRole('dialog').evaluate(e => Boolean(e.closest('[inert]'))), false);
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      assert.equal(nodes.some(n => !n.ignored && n.name?.value === '배경 화면'), false);
    });
    await run('Tab·Shift+Tab은 활성 컨트롤만 순환하며 제목에서 양방향으로 진입한다', async ({ page, open, loaded, inside }) => {
      await open(); await loaded();
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.getByRole('button', { name: '취소' }).evaluate(e => document.activeElement === e), true);
      await page.keyboard.press('Tab'); assert.equal(await page.getByRole('link', { name: '원문 확인' }).first().evaluate(e => document.activeElement === e), true);
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.getByRole('button', { name: '취소' }).evaluate(e => document.activeElement === e), true);
      await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '확인하고 등록' }).focus();
      await page.keyboard.press('Tab'); assert.equal(await page.getByRole('link', { name: '원문 확인' }).first().evaluate(e => document.activeElement === e), true);
      for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); await inside(); }
    });
    await run('프로그램 포커스와 새 배경 포털도 이탈할 수 없고 기존 속성을 정확히 복원한다', async ({ page, open, close, inside }) => {
      await page.evaluate(() => { const aside = document.createElement('aside'); aside.id = 'existing'; aside.setAttribute('inert', 'original'); aside.setAttribute('aria-hidden', 'false'); document.body.append(aside); });
      await open();
      await page.evaluate(() => { const button = document.createElement('button'); button.id = 'late'; button.textContent = '늦은 배경'; document.body.append(button); });
      await page.waitForFunction(() => document.getElementById('late').inert);
      await page.evaluate(() => { document.getElementById('late').focus(); document.querySelector('input[aria-label="배경 입력"]').focus(); }); await inside();
      await page.keyboard.press('Escape'); await close();
      assert.equal(await page.locator('#existing').getAttribute('inert'), 'original'); assert.equal(await page.locator('#existing').getAttribute('aria-hidden'), 'false');
      assert.equal(await page.locator('#late').getAttribute('inert'), null); assert.equal(await page.locator('#root').getAttribute('aria-hidden'), null);
    });
    await run('Escape 취소 및 취소 버튼은 열기 전 요소로 포커스를 복원한다', async ({ page, open, close }) => {
      await open(); await page.keyboard.press('Escape'); await close();
      assert.equal(await page.getByRole('button', { name: '직접 등록', exact: true }).evaluate(e => document.activeElement === e), true);
      await open(); await page.getByRole('button', { name: '취소' }).click(); await close();
      assert.equal(await page.getByRole('button', { name: '직접 등록', exact: true }).evaluate(e => document.activeElement === e), true);
      await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.__r05Cancels), 2);
    });
    await run('로딩·모든 컨트롤 비활성 상태에서도 포커스가 창 안에 있고 빈 데이터는 제출하지 않는다', async ({ page, open, inside }) => {
      await page.evaluate(() => window.__r05Held.add('a')); await open();
      await page.getByRole('checkbox').check(); await page.evaluate(() => document.querySelector('.confirm-dialog form').requestSubmit());
      assert.equal(await page.evaluate(() => window.__r05DirectCalls?.length || 0), 0);
      await page.evaluate(() => window.__r05SetBusy(true));
      for (let i = 0; i < 4; i++) { await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); await inside(); }
      await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 1);
      await page.evaluate(() => { window.__r05Release('a'); window.__r05SetBusy(false); });
    });
    await run('상세 조회 오류에서도 Tab·Escape 취소와 포커스 복원이 작동한다', async ({ page, open, close, inside }) => {
      await page.evaluate(() => { window.__r05FailDetail = 'a'; }); await open(); await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('button', { name: '확인하고 등록' }).isDisabled(), true);
      await page.keyboard.press('Tab'); await inside(); await page.keyboard.press('Escape'); await close();
      assert.equal(await page.getByRole('button', { name: '직접 등록', exact: true }).evaluate(e => document.activeElement === e), true);
    });
    await run('체크박스 검증과 같은 프레임의 중복 제출·저장 중 Escape 방지를 유지한다', async ({ page, open, loaded, inside, close }) => {
      await page.evaluate(() => { window.__r05HoldConfirm = true; }); await open(); await loaded();
      await page.evaluate(() => document.querySelector('.confirm-dialog form').requestSubmit());
      assert.equal(await page.evaluate(() => window.__r05DirectCalls?.length || 0), 0);
      await page.getByRole('checkbox').check();
      await page.evaluate(() => { const form = document.querySelector('.confirm-dialog form'); form.requestSubmit(); form.requestSubmit(); });
      await page.waitForFunction(() => window.__r05DirectCalls?.length === 1);
      await page.keyboard.press('Escape'); await inside(); assert.equal(await page.getByRole('dialog').count(), 1);
      assert.equal(await page.getByRole('button', { name: '취소' }).isDisabled(), true);
      await page.evaluate(() => window.__r05FinishConfirm(true)); await close();
      assert.equal(await page.getByRole('button', { name: '직접 등록', exact: true }).evaluate(e => document.activeElement === e), true);
    });
    await run('수정에서는 체크박스 없이 변경된 날짜·시각·장소만 보낸다', async ({ page, open, loaded, close }) => {
      await open('직접 수정'); await loaded(); assert.equal(await page.getByRole('checkbox').count(), 0);
      const inputs = page.locator('.confirm-dialog fieldset').first();
      await inputs.getByLabel('종료·마감일', { exact: true }).fill('2026-12-22');
      await inputs.getByLabel('시작 시각', { exact: true }).fill('10:00');
      await inputs.getByRole('textbox', { name: '장소', exact: true }).fill('수정 장소');
      await page.getByRole('button', { name: '수정 내용 저장' }).click(); await close();
      assert.deepEqual(await page.evaluate(() => window.__r05DirectCalls), [{ a: { end_date: '2026-12-22', start_time: '10:00', location: '수정 장소' } }]);
    });
    await run('제출 예외와 재시도는 수정 값·체크를 유지하고 잠금을 해제한다', async ({ page, open, loaded, close }) => {
      await page.evaluate(() => { window.__r05ThrowConfirm = true; }); await open(); await loaded();
      await page.getByRole('textbox', { name: '장소', exact: true }).first().fill('재시도 장소'); await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '확인하고 등록' }).click(); await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('checkbox').isChecked(), true); assert.equal(await page.getByRole('textbox', { name: '장소', exact: true }).first().inputValue(), '재시도 장소');
      await page.evaluate(() => { window.__r05ThrowConfirm = false; }); await page.getByRole('button', { name: '확인하고 등록' }).click(); await close();
      assert.equal(await page.evaluate(() => window.__r05DirectCalls.length), 2);
    });
    await run('열기 요소가 사라지면 배경을 복구한 뒤 main으로 안전하게 포커스를 옮긴다', async ({ page, open, close }) => {
      await open(); await page.evaluate(() => window.__r05RemoveTrigger()); await page.keyboard.press('Escape'); await close();
      assert.equal(await page.locator('main').evaluate(e => document.activeElement === e), true);
      assert.equal(await page.locator('#root').getAttribute('inert'), null);
      await page.getByRole('textbox', { name: '배경 입력' }).focus(); assert.equal(await page.locator('main').getAttribute('tabindex'), null);
    });
    await run('연속 요청은 이전 입력·체크·늦은 상세 및 저장 오류를 다음 창에 섞지 않는다', async ({ page, open, loaded, inside }) => {
      await page.evaluate(() => { window.__r05HoldConfirm = true; window.__r05KeepOpen = true; }); await open(); await loaded();
      await page.getByRole('textbox', { name: '장소', exact: true }).first().fill('이전 값'); await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '확인하고 등록' }).click();
      await page.evaluate(() => window.__r05SetRequest({ id: 'b', interview: false })); await loaded();
      assert.equal(await page.getByRole('checkbox').isChecked(), false); assert.equal(await page.getByRole('textbox', { name: '장소', exact: true }).inputValue(), '원래 장소');
      await page.evaluate(() => window.__r05FinishConfirm(false)); await delay(100);
      assert.equal(await page.getByRole('alert').count(), 0); await inside();
      await page.evaluate(() => { window.__r05Held.add('a'); window.__r05SetRequest({ id: 'a', interview: false }); });
      await page.getByRole('status').waitFor(); await page.evaluate(() => window.__r05SetRequest({ id: 'b', interview: false })); await loaded();
      await page.evaluate(() => window.__r05Release('a')); await delay(100);
      assert.equal(await page.locator('.confirm-dialog legend').first().innerText(), '접수 · b 공지');
    });
    await run('작은 모바일 화면에서 내용은 내부 스크롤되고 하단 버튼에 도달한다', async ({ page, open, loaded }) => {
      await page.setViewportSize({ width: 360, height: 480 });
      await page.evaluate(() => {
        const base = window.__r05Remote.find(e => e.id === 'a');
        for (let i = 0; i < 8; i++) window.__r05Remote.push({ ...base, id: 'extra' + i });
      });
      await open(); await loaded();
      const size = await page.getByRole('dialog').evaluate(e => ({ scroll: e.scrollHeight, height: e.clientHeight, box: e.getBoundingClientRect().toJSON(), viewport: innerHeight, horizontal: e.scrollWidth > e.clientWidth }));
      assert.ok(size.scroll > size.height); assert.ok(size.box.top >= 0 && size.box.bottom <= size.viewport); assert.equal(size.horizontal, false);
      await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '확인하고 등록' }).focus();
      const button = await page.getByRole('button', { name: '확인하고 등록' }).boundingBox(); assert.ok(button.y >= 0 && button.y + button.height <= 480);
      await page.keyboard.press('Tab'); assert.equal(await page.getByRole('link', { name: '원문 확인' }).first().evaluate(e => document.activeElement === e), true);
    });
    await run('실제 묶음 등록은 원래 버튼을 복원하고 면접을 포함하지 않는다', async ({ page, open, loaded, close }) => {
      await open(); await loaded(); assert.equal(await page.locator('.confirm-dialog fieldset').count(), 2);
      await page.getByRole('textbox', { name: '장소', exact: true }).first().fill('묶음 장소'); await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '확인하고 등록' }).click(); await close();
      assert.equal(await page.getByRole('button', { name: '묶음 등록', exact: true }).evaluate(e => document.activeElement === e), true);
      assert.deepEqual(await page.evaluate(() => window.__r05Writes), [{ id: 'a', overrides: { a: { location: '묶음 장소' } }, confirmed: true, interview: false }]);
      assert.deepEqual(await page.evaluate(() => window.__r05Remote.filter(e => e.registered).map(e => e.id)), ['a', 'a2']);
    }, false);
    await run('실제 면접 등록은 선택한 면접만 보내고 등록 실패 후 재시도할 수 있다', async ({ page, open, loaded, close }) => {
      await page.evaluate(() => { window.__r05FailWrite = true; }); await open('면접 등록'); await loaded();
      assert.equal(await page.locator('.confirm-dialog fieldset').count(), 1); await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '확인하고 등록' }).click(); await page.getByRole('dialog').getByRole('alert').waitFor();
      await page.evaluate(() => { window.__r05FailWrite = false; }); await page.getByRole('button', { name: '확인하고 등록' }).click(); await close();
      assert.ok(await page.evaluate(() => window.__r05Writes.every(w => w.id === 'a3' && w.interview && w.confirmed)));
      assert.deepEqual(await page.evaluate(() => window.__r05Remote.filter(e => e.registered).map(e => e.id)), ['a3']);
    }, false);
    await run('실제 수정 확인은 체크박스 없이 overrides를 보내고 수정 버튼으로 복원한다', async ({ page, open, loaded, close }) => {
      await open('일정 수정'); await loaded(); assert.equal(await page.getByRole('checkbox').count(), 0);
      await page.getByRole('textbox', { name: '장소', exact: true }).last().fill('본행사 수정');
      await page.getByRole('button', { name: '수정 내용 저장' }).click(); await close();
      assert.deepEqual(await page.evaluate(() => window.__r05Writes), [{ id: 'a', overrides: { a2: { location: '본행사 수정' } }, confirmed: true, interview: false }]);
      assert.equal(await page.getByRole('button', { name: '일정 수정', exact: true }).evaluate(e => document.activeElement === e), true);
    }, false);
    await run('실제 연속 등록 큐는 다음 사전 조회 중에도 창과 배경 차단을 유지한다', async ({ page, open, loaded, inside, close }) => {
      await open('전체 등록'); await loaded(); await page.getByRole('checkbox').check();
      await page.evaluate(() => window.__r05Held.add('b')); await page.getByRole('button', { name: '확인하고 등록' }).click();
      await page.waitForFunction(() => window.__r05Pending.some(p => p.id === 'b')); await delay(150);
      assert.equal(await page.getByRole('dialog').count(), 1); assert.equal(await page.locator('#root').getAttribute('inert'), ''); await inside();
      await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 1);
      await page.evaluate(() => window.__r05Release('b')); await page.getByRole('dialog').getByRole('textbox', { name: '장소', exact: true }).waitFor();
      assert.equal(await page.locator('.confirm-dialog legend').first().innerText(), '접수 · b 공지'); assert.equal(await page.getByRole('checkbox').isChecked(), false);
      assert.equal(await page.getByRole('dialog').getByRole('heading').evaluate(e => document.activeElement === e), true);
      await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '확인하고 등록' }).click(); await close();
      assert.deepEqual(await page.evaluate(() => window.__r05Writes.map(w => w.id)), ['a', 'b', 'n']);
      assert.equal(await page.getByRole('button', { name: '전체 등록', exact: true }).evaluate(e => document.activeElement === e), true);
    }, false);
    await run('후속 항목에 확인이 필요 없으면 기존 직접 등록 흐름으로 완료하고 창을 닫는다', async ({ page, open, loaded, close }) => {
      await page.evaluate(() => { window.__r05Remote.find(e => e.id === 'b').review_required = false; });
      await open('전체 등록'); await loaded(); await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: '확인하고 등록' }).click(); await close();
      assert.deepEqual(await page.evaluate(() => window.__r05Writes.map(w => [w.id, w.confirmed])), [['a', true], ['b', false], ['n', false]]);
      assert.equal(await page.locator('#root').getAttribute('inert'), null);
    }, false);
    await run('후속 사전 조회가 실패해도 이전 성공 항목을 다시 등록하지 않고 재시도할 수 있다', async ({ page, open, loaded, close }) => {
      await page.evaluate(() => { window.__r05FailDetail = 'b'; }); await open('전체 등록'); await loaded();
      await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '확인하고 등록' }).click(); await close();
      await page.getByRole('alert').waitFor(); assert.deepEqual(await page.evaluate(() => window.__r05Writes.map(w => w.id)), ['a']);
      assert.equal(await page.getByRole('button', { name: '전체 등록', exact: true }).evaluate(e => document.activeElement === e), true);
      await page.evaluate(() => { window.__r05FailDetail = null; }); await open('전체 등록'); await loaded();
      assert.equal(await page.locator('.confirm-dialog legend').first().innerText(), '접수 · b 공지');
      await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '확인하고 등록' }).click(); await close();
      assert.deepEqual(await page.evaluate(() => window.__r05Writes.map(w => w.id)), ['a', 'b', 'n']);
    }, false);
  } finally { await browser?.close(); await server.close(); }
});
