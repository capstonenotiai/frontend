import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// 별도 패키지/lock 변경 없이 실행한다. CI에서는 Playwright와 Chromium 경로를 지정할 수 있다.
const playwright = await import(process.env.R02_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('R02 공지 검색의 실제 React DOM·BrowserRouter 회귀', {
  skip: !playwright && 'Playwright 미설치: R02_PLAYWRIGHT_MODULE로 모듈 경로를 지정하세요.',
  timeout: 120_000,
}, async (t) => {
  const fixture = `
    import { useSyncExternalStore } from 'react';
    const events = [
      { id: 'a', title: '장학금 안내', category: 'scholarship', source: 'cbnu' },
      { id: 'b', title: '취업 설명회', category: 'career', source: 'wevity' },
      { id: 'c', title: '장학금 추가 모집', category: 'scholarship', source: 'wevity' },
      { id: 'd', title: 'all 공모전', category: 'contest', source: 'cbnu' },
      { id: 'e', title: '취업 장학금 안내', category: 'career', source: 'cbnu' },
    ].map(event => ({ ...event, end_date: '2026-10-20', event_type: 'application' }));
    let data = { events, calendarEvents: [], status: 'ready', summary: {}, actionBusy: false };
    const listeners = new Set();
    const subscribe = callback => { listeners.add(callback); return () => listeners.delete(callback); };
    window.__r02SetStatus = status => { data = { ...data, status }; listeners.forEach(callback => callback()); };
    export function useAppData() { return useSyncExternalStore(subscribe, () => data); }
  `;
  const entry = `
    import React, { StrictMode, Suspense, useLayoutEffect } from 'react';
    import { createRoot } from 'react-dom/client';
    import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
    import SchedulesPage from '/src/pages/SchedulesPage.jsx';
    function Gate({ children }) {
      const { search } = useLocation();
      if (window.__r02Hold?.search === search) throw window.__r02Hold.promise;
      return children;
    }
    function App() {
      const navigate = useNavigate();
      const location = useLocation();
      useLayoutEffect(() => { window.__r02Navigate = navigate; }, [navigate]);
      useLayoutEffect(() => { window.__r02CommittedKey = location.key; }, [location.key]);
      return React.createElement(Suspense, { fallback: React.createElement('p', null, '탐색 대기') },
        React.createElement(Gate, null, React.createElement(Routes, null,
          React.createElement(Route, { path: '/schedules', element: React.createElement(SchedulesPage) }),
          React.createElement(Route, { path: '/away', element: React.createElement('p', null, '다른 페이지') }))));
    }
    createRoot(document.getElementById('root')).render(React.createElement(StrictMode, null,
      React.createElement(BrowserRouter, null, React.createElement(App))));
  `;
  const server = await createServer({
    configFile: false, envDir: false,
    plugins: [{
      name: 'r02-browser-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__r02_entry.jsx') return '\0r02-entry.jsx'; },
      load(id) {
        const path = id.replaceAll('\\', '/');
        if (id === '\0r02-entry.jsx') return entry;
        if (path.endsWith('/src/context/AppDataContext.jsx')) return fixture;
        if (path.endsWith('/src/services/eventService.js')) return 'export async function getEventDetail() { return { events: [] }; }';
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (!/^\/(schedules|away)(\?|$)/.test(req.url)) { next(); return; }
          try {
            const html = await vite.transformIndexHtml(req.url,
              '<!doctype html><html lang="ko"><body><div id="root"></div><script type="module" src="/__r02_entry.jsx"></script></body></html>');
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch (error) { next(error); }
        });
      },
    }, react()],
    server: { host: '127.0.0.1', port: 0, ws: false },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-router-dom'] },
  });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({
      executablePath: process.env.R02_CHROMIUM_EXECUTABLE || undefined,
      headless: true,
      args: ['--no-sandbox'],
    });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const run = (name, action, url = '/schedules') => t.test(name, async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.clock.install({ time: new Date('2026-10-14T00:00:00Z') });
        await page.clock.pauseAt(new Date('2026-10-14T00:00:01Z'));
        await page.goto(origin + url);
        await page.getByRole('textbox', { name: '공지 검색' }).waitFor();
        const input = page.getByRole('textbox', { name: '공지 검색' });
        const params = () => new URL(page.url()).searchParams;
        const query = async (value) => assert.equal(await input.inputValue(), value);
        const rows = async (count) => assert.equal(await page.locator('.event-row').count(), count);
        const settleNavigation = async () => {
          // URL 변경에 이어 React의 transition도 완료되도록 기다린다. 브라우저 시계는 정지 상태다.
          for (let attempt = 0; attempt < 100; attempt += 1) {
            if (await page.evaluate(() => window.__r02CommittedKey === history.state.key)) return;
            await delay(10);
          }
          assert.fail('라우터 탐색이 commit되지 않았습니다.');
        };
        const navigate = async (to) => {
          await page.evaluate(to => window.__r02Navigate(to), to);
          await settleNavigation();
        };
        const composition = async (type, value) => page.evaluate(({ type, value }) => {
          const element = document.querySelector('input[aria-label="공지 검색"]');
          if (type === 'start') {
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
          } else {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
            element.dispatchEvent(type === 'end'
              ? new CompositionEvent('compositionend', { bubbles: true, data: value })
              : new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: value, isComposing: true }));
          }
        }, { type, value });
        await action({ page, input, params, query, rows, navigate, settleNavigation, composition });
        assert.deepEqual(errors, [], '브라우저 런타임 오류가 없어야 한다');
      } finally { await page.close(); }
    });

    await run('직접 URL의 검색어·필터로 초기 렌더링하며 불필요한 URL 쓰기가 없다', async ({ page, params, query, rows }) => {
      await query('장학'); await rows(1);
      const before = await page.evaluate(() => ({ key: history.state.key, length: history.length }));
      await page.clock.runFor(500);
      assert.equal(params().get('extra'), 'keep');
      assert.deepEqual(await page.evaluate(() => ({ key: history.state.key, length: history.length })), before);
    }, '/schedules?q=%EC%9E%A5%ED%95%99&cat=scholarship&src=cbnu&extra=keep');

    await run('빠른 입력은 즉시 결과를 갱신하고 마지막 입력 250ms 뒤 replace한다', async ({ page, input, params, query, rows }) => {
      const before = await page.evaluate(() => ({ length: history.length, index: history.state.idx }));
      await input.focus();
      for (const value of ['장', '학', '금']) await page.keyboard.insertText(value);
      await query('장학금'); await rows(3);
      assert.equal(params().has('q'), false);
      await page.clock.runFor(249); assert.equal(params().has('q'), false);
      await page.clock.runFor(1); assert.equal(params().get('q'), '장학금');
      await query('장학금');
      assert.deepEqual(await page.evaluate(() => ({ length: history.length, index: history.state.idx })), before);
    });

    await run('IME 조합 시작이 기존 예약을 취소하고 조합 종료 값만 URL에 쓴다', async ({ page, input, params, query, composition }) => {
      await input.fill('취업');
      await composition('start');
      await composition('input', 'ㅈ');
      await page.clock.runFor(500);
      await query('ㅈ'); assert.equal(params().has('q'), false);
      await composition('input', '장학');
      await page.clock.runFor(500);
      await query('장학'); assert.equal(params().has('q'), false);
      await composition('end', '장학금');
      await query('장학금');
      await page.clock.runFor(249); assert.equal(params().has('q'), false);
      await page.clock.runFor(1); assert.equal(params().get('q'), '장학금');
    });

    await run('Chromium IME 프로토콜의 실제 조합 이벤트로 최종 한글을 입력한다', async ({ page, input, params, query }) => {
      const cdp = await page.context().newCDPSession(page);
      await input.focus();
      await cdp.send('Input.imeSetComposition', { text: '장', selectionStart: 1, selectionEnd: 1 });
      await query('장'); await page.clock.runFor(500); assert.equal(params().has('q'), false);
      await cdp.send('Input.imeSetComposition', { text: '장학금', selectionStart: 3, selectionEnd: 3 });
      await query('장학금'); await page.clock.runFor(500); assert.equal(params().has('q'), false);
      await cdp.send('Input.insertText', { text: '장학금' });
      await query('장학금'); await page.clock.runFor(250); assert.equal(params().get('q'), '장학금');
      await cdp.detach();
    });

    await run('중간 커서에서 한글을 삽입해도 문자열과 커서 위치를 보존한다', async ({ page, input, params, query }) => {
      await input.fill('장학금 안내');
      await input.press('Home'); await input.press('ArrowRight'); await page.keyboard.insertText('기');
      await query('장기학금 안내');
      assert.equal(await input.evaluate(element => element.selectionStart), 2);
      await page.clock.runFor(250); assert.equal(params().get('q'), '장기학금 안내');
      assert.equal(await input.evaluate(element => element.selectionStart), 2);
    });

    await run('지우기 버튼은 q만 즉시 제거하고 예약된 검색을 되살리지 않는다', async ({ page, input, params, query, rows }) => {
      await input.fill('장학');
      await page.getByRole('button', { name: '검색어 지우기' }).click();
      await query(''); await rows(2);
      assert.equal(params().has('q'), false);
      await page.clock.runFor(500);
      await query(''); assert.equal(params().has('q'), false);
      assert.equal(params().get('cat'), 'career'); assert.equal(params().get('extra'), 'keep');
    }, '/schedules?q=%EC%B7%A8%EC%97%85&cat=career&extra=keep');

    await run('Backspace 전체 삭제는 즉시 q를 제거한다', async ({ page, input, params, query }) => {
      await input.fill('장학금');
      await input.press('ControlOrMeta+A'); await input.press('Backspace');
      await query(''); assert.equal(params().has('q'), false);
      await page.clock.runFor(500); await query(''); assert.equal(params().has('q'), false);
    }, '/schedules?q=old');

    await run('전체 필터 초기화는 로컬 검색어와 예약을 함께 비운다', async ({ page, input, params, query, rows }) => {
      await input.fill('없는검색어');
      await page.getByRole('button', { name: '필터 초기화' }).click();
      await query(''); await rows(5);
      await page.clock.runFor(500);
      for (const key of ['q', 'cat', 'src']) assert.equal(params().has(key), false);
      assert.equal(params().get('extra'), 'keep');
    }, '/schedules?cat=career&src=cbnu&extra=keep');

    await run('같은 이벤트 루프의 분야·출처 변경과 검색 예약을 최신 파라미터에 합친다', async ({ page, input, params, query, rows }) => {
      await input.fill('장학');
      await page.evaluate(() => {
        [...document.querySelectorAll('.notice-chip')].find(button => button.textContent === '장학').click();
        const source = document.querySelector('select[aria-label="출처"]');
        source.value = 'cbnu'; source.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await query('장학');
      await page.clock.runFor(250);
      assert.equal(params().get('q'), '장학');
      assert.equal(params().get('cat'), 'scholarship'); assert.equal(params().get('src'), 'cbnu');
      assert.equal(params().get('extra'), 'keep'); await rows(1);
    }, '/schedules?extra=keep');

    await run('뒤로·앞으로 탐색은 예약된 입력보다 URL을 우선한다', async ({ page, input, params, query, rows, navigate }) => {
      await navigate('/schedules?q=%EC%B7%A8%EC%97%85&cat=career');
      await query('취업'); await rows(2);
      await input.fill('폐기할검색어');
      await page.goBack(); await query('장학'); await rows(2);
      await page.clock.runFor(500); assert.equal(params().get('q'), '장학');
      await page.goForward(); await query('취업'); await rows(2);
      await page.clock.runFor(500); assert.equal(params().get('q'), '취업');
    }, '/schedules?q=%EC%9E%A5%ED%95%99&cat=scholarship');

    await run('동일 q의 다른 히스토리로 돌아가도 임시 입력을 취소한다', async ({ page, input, params, query, rows, navigate }) => {
      await navigate('/schedules?q=%EC%9E%A5%ED%95%99&cat=career');
      await rows(1); await input.fill('폐기할검색어');
      await page.goBack(); await query('장학'); await rows(2);
      await page.clock.runFor(500); assert.equal(params().get('cat'), 'scholarship');
      assert.equal(params().get('q'), '장학');
    }, '/schedules?q=%EC%9E%A5%ED%95%99&cat=scholarship');

    await run('같은 페이지의 알림 진입은 아직 URL에 없는 검색어와 예약을 폐기한다', async ({ page, input, params, query, navigate }) => {
      await input.fill('대상을숨기는검색어');
      await navigate('/schedules?open=b&extra=keep');
      await query('');
      const target = page.getByRole('button', { name: /취업 설명회/ });
      assert.equal(await target.getAttribute('aria-expanded'), 'true');
      assert.equal(await target.evaluate(element => document.activeElement === element), true);
      await page.clock.runFor(500);
      assert.equal(params().has('q'), false); assert.equal(params().has('open'), false);
      assert.equal(params().get('extra'), 'keep'); assert.equal(await target.getAttribute('aria-expanded'), 'true');
    });

    await run('필터에 가려진 딥링크 대상은 검색과 필터를 해제하고 펼친다', async ({ page, params, query }) => {
      await query('');
      assert.equal(await page.getByRole('button', { name: /취업 설명회/ }).getAttribute('aria-expanded'), 'true');
      for (const key of ['q', 'cat', 'src', 'open']) assert.equal(params().has(key), false);
      assert.equal(params().get('extra'), 'keep');
      await page.clock.runFor(500); await query('');
    }, '/schedules?q=%EC%9E%A5%ED%95%99&cat=scholarship&src=cbnu&open=b&extra=keep');

    await run('로딩 중 open을 유지하고 준비 후 대상 표시를 완료한다', async ({ page, input, params, query, navigate }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await input.fill('이전검색');
      await navigate('/schedules?open=b');
      await input.fill('대상을숨기는검색어');
      await page.clock.runFor(500);
      assert.equal(params().get('open'), 'b'); assert.equal(params().has('q'), false);
      await page.evaluate(() => window.__r02SetStatus('ready'));
      await query('');
      assert.equal(await page.getByRole('button', { name: /취업 설명회/ }).getAttribute('aria-expanded'), 'true');
      await page.clock.runFor(500); assert.equal(params().has('q'), false); assert.equal(params().has('open'), false);
    });

    await run('문제 A: 분야 변경과 데이터 준비가 겹쳐도 최신 필터로 알림 대상을 표시한다', async ({ page, params, navigate, settleNavigation }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b&extra=keep');
      await page.evaluate(() => {
        let release;
        const promise = new Promise(resolve => { release = resolve; });
        window.__r02Hold = { search: '?open=b&extra=keep&cat=scholarship', promise, release };
        [...document.querySelectorAll('.notice-chip')].find(button => button.textContent === '장학').click();
        window.__r02SetStatus('ready');
      });
      await page.evaluate(() => { const hold = window.__r02Hold; window.__r02Hold = null; hold.release(); });
      await settleNavigation();
      const target = page.getByRole('button', { name: /취업 설명회/ });
      assert.equal(await target.count(), 1);
      assert.equal(await target.getAttribute('aria-expanded'), 'true');
      assert.equal(await target.evaluate(element => document.activeElement === element), true);
      assert.equal(params().has('cat'), false); assert.equal(params().has('open'), false);
      assert.equal(params().get('extra'), 'keep');
    });

    await run('문제 A: 출처 변경과 데이터 준비가 겹쳐도 최신 필터로 알림 대상을 표시한다', async ({ page, params, navigate, settleNavigation }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b&extra=keep');
      await page.evaluate(() => {
        let release;
        const promise = new Promise(resolve => { release = resolve; });
        window.__r02Hold = { search: '?open=b&extra=keep&src=cbnu', promise, release };
        const source = document.querySelector('select[aria-label="출처"]');
        source.value = 'cbnu'; source.dispatchEvent(new Event('change', { bubbles: true }));
        window.__r02SetStatus('ready');
      });
      await page.evaluate(() => { const hold = window.__r02Hold; window.__r02Hold = null; hold.release(); });
      await settleNavigation();
      const target = page.getByRole('button', { name: /취업 설명회/ });
      assert.equal(await target.count(), 1);
      assert.equal(await target.getAttribute('aria-expanded'), 'true');
      assert.equal(params().has('src'), false); assert.equal(params().has('open'), false);
      assert.equal(params().get('extra'), 'keep');
    });

    await run('문제 B: 알림 준비 중 유지한 검색어는 처리 후 250ms에 URL 동기화를 재개한다', async ({ page, input, params, query, rows, navigate, settleNavigation }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b&src=wevity&extra=keep');
      await input.fill('취업'); await page.clock.runFor(500);
      assert.equal(params().has('q'), false);
      await page.evaluate(() => window.__r02SetStatus('ready'));
      await settleNavigation();
      await query('취업'); await rows(1);
      await page.clock.runFor(249); assert.equal(params().has('q'), false);
      await page.clock.runFor(1); assert.equal(params().get('q'), '취업');
      assert.equal(params().get('src'), 'wevity'); assert.equal(params().get('extra'), 'keep');
      assert.equal(params().has('open'), false);
      assert.equal(await page.getByRole('button', { name: /취업 설명회/ }).getAttribute('aria-expanded'), 'true');
    });

    await run('알림 대상이 없더라도 대기 중 입력한 일반 검색어의 동기화를 재개한다', async ({ page, input, params, query, navigate, settleNavigation }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=missing&extra=keep');
      await input.fill('all');
      await page.evaluate(() => window.__r02SetStatus('ready'));
      await settleNavigation(); await page.clock.runFor(250);
      await query('all'); assert.equal(params().get('q'), 'all');
      assert.equal(params().has('open'), false); assert.equal(params().get('extra'), 'keep');
    });

    await run('알림 처리 후에도 IME 조합이 끝나기 전에는 검색 URL을 갱신하지 않는다', async ({ page, params, query, navigate, settleNavigation, composition }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b&extra=keep');
      // 실제 Chromium은 행 포커스 이동 시 조합을 확정하므로, 미완료 조합은 이벤트로 유지한다.
      await composition('start'); await composition('input', '취');
      await page.evaluate(() => window.__r02SetStatus('ready'));
      await settleNavigation(); await page.clock.runFor(500);
      await query('취'); assert.equal(params().has('q'), false); assert.equal(params().has('open'), false);
      await composition('input', '취업');
      await page.clock.runFor(500); assert.equal(params().has('q'), false);
      await composition('end', '취업');
      await page.clock.runFor(250); await query('취업'); assert.equal(params().get('q'), '취업');
      assert.equal(params().get('extra'), 'keep');
    });

    await run('Chromium이 알림 행 포커스로 IME를 확정하면 확정된 검색어를 URL에 반영한다', async ({ page, input, params, query, navigate, settleNavigation }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b');
      await input.evaluate(element => element.addEventListener('compositionend', () => { window.__r02CompositionEnded = true; }));
      const cdp = await page.context().newCDPSession(page);
      await input.focus();
      await cdp.send('Input.imeSetComposition', { text: '취', selectionStart: 1, selectionEnd: 1 });
      await page.evaluate(() => window.__r02SetStatus('ready'));
      await settleNavigation(); await page.clock.runFor(250);
      assert.equal(await page.evaluate(() => window.__r02CompositionEnded), true);
      await query('취'); assert.equal(params().get('q'), '취'); assert.equal(params().has('open'), false);
      assert.equal(await page.getByRole('button', { name: /취업 설명회/ }).evaluate(element => document.activeElement === element), true);
      await cdp.detach();
    });

    await run('알림을 위해 초기화한 조합 검색어는 처리 후 다시 예약되거나 복원되지 않는다', async ({ page, params, query, navigate, settleNavigation, composition }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b');
      await composition('start'); await composition('input', '장학');
      await page.evaluate(() => window.__r02SetStatus('ready'));
      await settleNavigation(); await query('');
      await composition('end', '장학금'); await page.clock.runFor(500);
      await query(''); assert.equal(params().has('q'), false); assert.equal(params().has('open'), false);
      assert.equal(await page.getByRole('button', { name: /취업 설명회/ }).getAttribute('aria-expanded'), 'true');
    });

    await run('문제 A와 B가 연속 발생해도 초기화와 검색 동기화가 서로 덮어쓰지 않는다', async ({ page, input, params, query, navigate, settleNavigation }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b&extra=first');
      await page.evaluate(() => {
        [...document.querySelectorAll('.notice-chip')].find(button => button.textContent === '장학').click();
        window.__r02SetStatus('ready');
      });
      await settleNavigation(); await page.clock.runFor(500);
      assert.equal(await page.getByRole('button', { name: /취업 설명회/ }).count(), 1);
      assert.equal(params().has('cat'), false);
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b&src=wevity&extra=second');
      await input.fill('취업');
      await page.evaluate(() => window.__r02SetStatus('ready'));
      await settleNavigation(); await page.clock.runFor(250);
      await query('취업'); assert.equal(params().get('q'), '취업');
      assert.equal(params().get('src'), 'wevity'); assert.equal(params().get('extra'), 'second');
      assert.equal(params().has('open'), false);
    });

    await run('알림 로딩 완료와 지연된 외부 탐색이 겹치면 이동한 URL의 상태를 우선한다', async ({ page, input, params, query, rows, navigate, settleNavigation }) => {
      await page.evaluate(() => window.__r02SetStatus('loading'));
      await navigate('/schedules?open=b&extra=old');
      await input.fill('취업');
      await page.evaluate(() => {
        let release;
        const promise = new Promise(resolve => { release = resolve; });
        window.__r02Hold = { search: '?q=%EC%9E%A5%ED%95%99&cat=scholarship&src=cbnu&extra=new', promise, release };
        window.__r02Navigate('/schedules?q=%EC%9E%A5%ED%95%99&cat=scholarship&src=cbnu&extra=new');
        window.__r02SetStatus('ready');
      });
      await page.clock.runFor(500);
      assert.equal(params().get('q'), '장학'); assert.equal(params().get('extra'), 'new');
      assert.equal(params().has('open'), false);
      await page.evaluate(() => { const hold = window.__r02Hold; window.__r02Hold = null; hold.release(); });
      await settleNavigation(); await page.clock.runFor(500);
      await query('장학'); await rows(1);
      assert.equal(params().get('cat'), 'scholarship'); assert.equal(params().get('src'), 'cbnu');
      assert.equal(params().get('q'), '장학'); assert.equal(params().get('extra'), 'new');
    });

    await run('이미 보이는 딥링크 대상은 검색·분야·출처를 보존한다', async ({ page, params, query, rows }) => {
      await query('취업'); await rows(1);
      assert.equal(await page.getByRole('button', { name: /취업 설명회/ }).getAttribute('aria-expanded'), 'true');
      assert.equal(params().get('q'), '취업'); assert.equal(params().get('cat'), 'career');
      assert.equal(params().get('src'), 'wevity'); assert.equal(params().has('open'), false);
    }, '/schedules?q=%EC%B7%A8%EC%97%85&cat=career&src=wevity&open=b');

    await run('존재하지 않는 딥링크 대상은 기존 검색을 보존하고 open만 제거한다', async ({ params, query, rows }) => {
      await query('장학'); await rows(1);
      assert.equal(params().has('open'), false); assert.equal(params().get('q'), '장학');
      assert.equal(params().get('cat'), 'scholarship'); assert.equal(params().get('src'), 'cbnu');
    }, '/schedules?q=%EC%9E%A5%ED%95%99&cat=scholarship&src=cbnu&open=missing');

    await run('늦은 이전 URL commit은 최신 입력을 덮어쓰지 않는다', async ({ page, input, params, query, settleNavigation }) => {
      await page.evaluate(() => {
        let release;
        const promise = new Promise(resolve => { release = resolve; });
        window.__r02Hold = { search: '?q=%EC%9E%A5%ED%95%99', promise, release };
      });
      await input.fill('장학'); await page.clock.runFor(250);
      assert.equal(params().get('q'), '장학');
      await input.fill('장학금'); await query('장학금');
      await page.evaluate(() => { const hold = window.__r02Hold; window.__r02Hold = null; hold.release(); });
      await settleNavigation();
      await query('장학금');
      await page.clock.runFor(250); assert.equal(params().get('q'), '장학금'); await query('장학금');
    });

    await run('외부 탐색 commit 이전에도 예약된 검색이 이동한 URL을 덮어쓰지 않는다', async ({ page, input, params, query, settleNavigation }) => {
      await input.fill('폐기할검색어');
      await page.evaluate(() => {
        let release;
        const promise = new Promise(resolve => { release = resolve; });
        window.__r02Hold = { search: '?q=%EC%B7%A8%EC%97%85', promise, release };
        window.__r02Navigate('/schedules?q=%EC%B7%A8%EC%97%85');
      });
      await page.clock.runFor(500); assert.equal(params().get('q'), '취업');
      await page.evaluate(() => { const hold = window.__r02Hold; window.__r02Hold = null; hold.release(); });
      await settleNavigation();
      await query('취업'); await page.clock.runFor(500); assert.equal(params().get('q'), '취업');
    });

    await run('외부 탐색 commit 전 지우기와 필터 클릭도 새 URL을 덮어쓰지 않는다', async ({ page, input, params, query, rows, settleNavigation }) => {
      await input.fill('미완성검색');
      await page.evaluate(() => {
        let release;
        const promise = new Promise(resolve => { release = resolve; });
        window.__r02Hold = { search: '?q=%EC%B7%A8%EC%97%85&cat=career&src=wevity&extra=new', promise, release };
        window.__r02Navigate('/schedules?q=%EC%B7%A8%EC%97%85&cat=career&src=wevity&extra=new');
      });
      await page.getByRole('button', { name: '검색어 지우기' }).click();
      await page.getByRole('button', { name: '학사', exact: true }).click();
      await page.clock.runFor(500);
      assert.equal(params().get('q'), '취업'); assert.equal(params().get('cat'), 'career');
      assert.equal(params().get('src'), 'wevity'); assert.equal(params().get('extra'), 'new');
      await page.evaluate(() => { const hold = window.__r02Hold; window.__r02Hold = null; hold.release(); });
      await settleNavigation();
      await query('취업'); await rows(1);
    }, '/schedules?q=%EC%9E%A5%ED%95%99&extra=old');

    await run('동일 문자열의 외부 replace를 자체 URL 반영으로 오인하지 않는다', async ({ page, input, params, query, settleNavigation }) => {
      await page.evaluate(() => {
        let release;
        const promise = new Promise(resolve => { release = resolve; });
        window.__r02Hold = { search: '?q=%EC%9E%A5%ED%95%99', promise, release };
      });
      await input.fill('장학'); await page.clock.runFor(250);
      await input.fill('장학금');
      await page.evaluate(() => {
        window.__r02Navigate('/schedules?q=%EC%9E%A5%ED%95%99', { replace: true });
        const hold = window.__r02Hold; window.__r02Hold = null; hold.release();
      });
      await settleNavigation();
      await query('장학'); await page.clock.runFor(500); assert.equal(params().get('q'), '장학');
    });

    await run('조합 중 지우기 후 늦은 compositionend는 검색어를 복원하지 않는다', async ({ page, params, query, composition }) => {
      await composition('start'); await composition('input', '장학');
      await page.getByRole('button', { name: '검색어 지우기' }).click();
      await composition('end', '장학금');
      await query(''); await page.clock.runFor(500); assert.equal(params().has('q'), false);
    });

    await run('취소된 조합의 종료 이벤트가 없어도 다음 일반 입력을 받을 수 있다', async ({ page, input, params, query, composition }) => {
      await composition('start'); await composition('input', '장학');
      await page.getByRole('button', { name: '검색어 지우기' }).click();
      await input.fill('all'); await query('all');
      await composition('end', '이전조합'); await query('all');
      await page.clock.runFor(250); assert.equal(params().get('q'), 'all');
    });

    await run('페이지 이탈 후 이전 타이머가 공지 URL로 돌아오지 않는다', async ({ page, input, navigate }) => {
      await input.fill('장학'); await navigate('/away');
      await page.clock.runFor(500); assert.equal(new URL(page.url()).pathname, '/away');
    });

    await run('all과 공백·특수문자를 일반 검색어로 보존한다', async ({ page, input, params, query, rows }) => {
      await input.fill('all'); await rows(1);
      await page.clock.runFor(250); assert.equal(params().get('q'), 'all'); await query('all');
      await input.fill('  장학금 &+  ');
      await page.clock.runFor(250); assert.equal(params().get('q'), '  장학금 &+  '); await query('  장학금 &+  ');
      await input.fill('  장학금  '); await rows(3);
      await page.clock.runFor(250); assert.equal(params().get('q'), '  장학금  ');
    });
  } finally {
    await browser?.close();
    await server.close();
  }
});
