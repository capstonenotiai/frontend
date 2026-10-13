import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const playwright = await import(process.env.R03_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('R03 실제 Provider·React DOM 추천 캐시 회귀', {
  skip: !playwright && 'Playwright 미설치: R03_PLAYWRIGHT_MODULE을 지정하세요.', timeout: 120_000,
}, async (t) => {
  const services = `
    const copy = value => structuredClone(value);
    window.remote = {
      profile: { email: 'a@example.test', major: '컴퓨터', grade: 3, enrollment_status: 'enrolled' },
      preferences: { interests: ['career'], enabled_sources: { cbnu: true, wevity: true, contestkorea: true }, notifications: { d3: true, d1: true, email: true } },
      events: [{ id: 'a', title: '검증 공지', source: 'cbnu', category: 'career', end_date: '2026-12-20', registered: false, bookmarked: false, dismissed: false, action_status: 'pending' }],
    };
    window.requests = []; window.saves = []; window.failSave = false;
    const save = async (group, body) => {
      if (window.failSave) throw new Error('저장 실패');
      if (window.holdSaves) await new Promise(resolve => window.saves.push(resolve));
      window.remote[group] = { ...window.remote[group], ...copy(body) };
    };
    export const getProfile = async () => copy(window.remote.profile);
    export const getPreferences = async () => copy(window.remote.preferences);
    export const updateProfile = body => save('profile', body);
    export const updatePreferences = body => save('preferences', body);
    export const completeOnboarding = async () => copy(window.remote.profile);
    export const logout = async () => { if (window.failSave) throw new Error('로그아웃 실패'); };
    export const deleteAccount = async () => {};
    export const getEvents = async (hidden = false) => {
      if (window.failRead) throw new Error('조회 실패');
      return copy(window.remote.events.filter(e => (hidden || !e.dismissed) && window.remote.preferences.enabled_sources[e.source] !== false));
    };
    export const getEventDetail = async () => ({ events: copy(window.remote.events) });
    const mutate = async (id, patch) => {
      if (window.failSave) throw new Error('저장 실패');
      Object.assign(window.remote.events.find(e => e.id === id), patch);
    };
    export const setBookmark = (id, bookmarked) => mutate(id, { bookmarked });
    export const setActionStatus = (id, action_status) => mutate(id, { action_status });
    export const setDismissed = (id, dismissed) => mutate(id, { dismissed });
    export const updateOverrides = (id, patch) => mutate(id, patch);
    export const getRegisteredEvents = async () => copy(window.remote.events.filter(e => e.registered));
    export const registerEvent = id => mutate(id, { registered: true });
    export const unregisterEvent = id => mutate(id, { registered: false });
    export const registerInterview = registerEvent;
    export const syncEvent = async () => {};
    export const getDashboardSummary = async () => ({});
    export const getRecommendations = (mode, options) => new Promise((resolve, reject) => {
      window.requests.push({ mode, refresh: options.refresh, signal: options.signal,
        input: copy(window.remote), resolve: title => resolve({ mode, generated_at: new Date().toISOString(), items: [{ title, opportunity_id: title, next_step_label: 'act', grade: 'strong_match', tier: 'core' }] }),
        reject: status => reject(Object.assign(new Error('요청 실패'), { status })) });
    });
  `;
  const entry = `
    import React, { StrictMode, useLayoutEffect } from 'react';
    import { createRoot } from 'react-dom/client';
    import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
    import { UserProvider, useUser } from '/src/context/UserContext.jsx';
    import { AppDataProvider, useAppData } from '/src/context/AppDataContext.jsx';
    import PlannerPage from '/src/pages/PlannerPage.jsx';
    import SettingsPage from '/src/pages/SettingsPage.jsx';
    function Harness() {
      const user = useUser(), app = useAppData(), navigate = useNavigate(), location = useLocation();
      useLayoutEffect(() => { window.user = user; window.app = app; window.navigate = navigate; });
      return location.pathname === '/planner' ? React.createElement(PlannerPage)
        : location.pathname === '/settings' ? React.createElement(SettingsPage) : React.createElement('p', null, '다른 화면');
    }
    function Data() { const { sessionVersion } = useUser(); return React.createElement(AppDataProvider, { key: sessionVersion }, React.createElement(Harness)); }
    createRoot(document.getElementById('root')).render(React.createElement(StrictMode, null,
      React.createElement(BrowserRouter, null, React.createElement(UserProvider, null, React.createElement(Data)))));
  `;
  const server = await createServer({ configFile: false, envDir: false,
    plugins: [{ name: 'r03-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__r03.jsx') return '\0r03.jsx'; if (id === '/__r03-services.js') return '\0r03-services.js'; },
      load(id) {
        if (id === '\0r03.jsx') return entry;
        if (id === '\0r03-services.js') return services;
        if (/\/src\/services\/(user|event|calendar|dashboard|planner)Service\.js$/.test(id.replaceAll('\\', '/'))) return 'export * from "/__r03-services.js";';
      },
      configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
        if (!/^\/(planner|away|settings)(\?|$)/.test(req.url)) return next();
        try { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml(req.url,
          '<html><body><div id="root"></div><script type="module" src="/__r03.jsx"></script></body></html>')); } catch (error) { next(error); }
      }); },
    }, react()], server: { host: '127.0.0.1', port: 0, ws: false },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-router-dom'] },
  });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ executablePath: process.env.R03_CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox'] });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const run = (name, action) => t.test(name, async () => {
      const page = await browser.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(origin + '/planner?mode=priority');
        const count = () => page.evaluate(() => window.requests.length);
        const waitRequests = n => page.waitForFunction(n => window.requests?.length === n, n, { timeout: 5000 });
        const finish = async (index, title) => {
          await page.evaluate(({ index, title }) => window.requests[index].resolve(title), { index, title });
          await page.getByRole('button', { name: new RegExp(title) }).waitFor();
        };
        const change = async (method, ...args) => page.evaluate(async ({ method, args }) => window.app[method](...args), { method, args });
        const userChange = async (method, ...args) => page.evaluate(async ({ method, args }) => window.user[method](...args), { method, args });
        await waitRequests(1); await finish(0, '최초 추천');
        await action({ page, count, waitRequests, finish, change, userChange });
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });

    await run('변경 없는 조회·UI 변경·페이지 재진입은 30분 캐시를 재사용한다', async ({ page, count, change, userChange }) => {
      await change('refresh'); await userChange('setAiMode', 'focus'); await userChange('setNotification', 'email', false);
      await page.evaluate(() => window.navigate('/away'));
      await page.getByText('다른 화면').waitFor();
      await page.evaluate(() => window.navigate('/planner?mode=priority'));
      await page.getByRole('button', { name: /최초 추천/ }).waitFor(); await delay(350);
      assert.equal(await count(), 1);
    });
    await run('관심분야·프로필 저장 성공 후 최신 입력을 일반 요청으로 반영한다', async ({ page, userChange, waitRequests, finish }) => {
      await userChange('toggleInterest', 'contest'); await waitRequests(2);
      assert.deepEqual(await page.evaluate(() => window.requests[1].input.preferences.interests), ['career', 'contest']);
      assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 0);
      await finish(1, '관심 변경 추천');
      await userChange('updateProfile', { major: '수학', grade: 4, enrollment_status: 'leave' }); await waitRequests(3);
      assert.equal(await page.evaluate(() => window.requests[2].input.profile.major), '수학');
      assert.equal(await page.evaluate(() => window.requests.some(r => r.refresh)), false);
      await finish(2, '프로필 변경 추천');
    });
    await run('등록·해제·관심 저장·취소·완료·숨김·복원 성공마다 최신화한다', async ({ change, waitRequests, finish }) => {
      const actions = [['toggleRegister', 'a'], ['toggleRegister', 'a'], ['saveBookmark', 'a', true], ['saveBookmark', 'a', false], ['setActionStatus', 'a', 'done'], ['setDismissed', 'a', true], ['setDismissed', 'a', false]];
      for (const [i, [method, ...args]] of actions.entries()) {
        assert.equal(await change(method, ...args), true); await waitRequests(i + 2); await finish(i + 1, `변경 추천 ${i}`);
      }
    });
    await run('실패한 설정·일정 저장과 동일 값 저장은 캐시를 무효화하지 않는다', async ({ page, count, userChange, change }) => {
      await page.evaluate(() => { window.failSave = true; });
      assert.equal(await userChange('updateProfile', { major: '실패한 전공' }), false);
      assert.equal(await userChange('toggleInterest', 'contest'), false);
      assert.equal(await change('saveBookmark', 'a', true), false);
      await delay(350); assert.equal(await count(), 1);
      assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 1);
      await page.evaluate(() => { window.failSave = false; });
      await change('saveBookmark', 'a', false); await delay(350); assert.equal(await count(), 1);
    });
    await run('모든 모드 캐시는 입력 변경 후 폐기되고 각 모드는 다시 재사용된다', async ({ page, change, waitRequests, finish, count }) => {
      for (const [i, mode] of ['discover', 'focus'].entries()) {
        await page.evaluate(mode => window.navigate('/planner?mode=' + mode), mode); await waitRequests(i + 2); await finish(i + 1, `이전 ${mode}`);
      }
      await change('setActionStatus', 'a', 'done'); await waitRequests(4); await finish(3, '새 focus');
      for (const [i, mode] of ['priority', 'discover'].entries()) {
        await page.evaluate(mode => window.navigate('/planner?mode=' + mode), mode); await waitRequests(i + 5); await finish(i + 4, `새 ${mode}`);
      }
      await page.evaluate(() => window.navigate('/planner?mode=focus'));
      await page.getByRole('button', { name: /새 focus/ }).waitFor(); await delay(350); assert.equal(await count(), 6);
    });
    await run('빠른 연속 설정 저장은 최종 값으로 요청 하나만 생성한다', async ({ page, waitRequests, finish, count }) => {
      await page.evaluate(async () => { await Promise.all([window.user.updateProfile({ grade: 4 }), window.user.updateProfile({ grade: 5 }), window.user.updateProfile({ grade: 6 })]); });
      await waitRequests(2); assert.equal(await page.evaluate(() => window.requests[1].input.profile.grade), 6);
      await finish(1, '최종 학년'); await delay(350); assert.equal(await count(), 2);
    });
    await run('느린 저장 큐가 처리 중이면 중간 성공 값으로 추천을 요청하지 않는다', async ({ page, waitRequests, finish, count }) => {
      await page.evaluate(() => {
        window.holdSaves = true;
        window.user.updateProfile({ grade: 4 }); window.user.updateProfile({ grade: 5 });
      });
      await page.waitForFunction(() => window.saves.length === 1);
      await page.evaluate(() => window.saves.shift()());
      await page.waitForFunction(() => window.saves.length === 1);
      await delay(400); assert.equal(await count(), 1);
      await page.evaluate(() => window.saves.shift()());
      await waitRequests(2); assert.equal(await page.evaluate(() => window.requests[1].input.profile.grade), 5);
      await finish(1, '큐 최종 추천');
    });
    await run('플래너를 떠난 동안 변경해도 재진입 시 이전 캐시를 사용하지 않는다', async ({ page, userChange, change, waitRequests, finish }) => {
      await page.evaluate(() => window.navigate('/away')); await page.getByText('다른 화면').waitFor();
      await userChange('updateProfile', { major: '통계' }); await change('saveBookmark', 'a', true);
      await page.evaluate(() => window.navigate('/planner?mode=priority')); await waitRequests(2);
      assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 0);
      await finish(1, '재진입 최신 추천');
    });
    await run('출처 저장 성공은 재조회 완료 후 반영하고 실패한 출처 저장은 캐시를 유지한다', async ({ page, userChange, waitRequests, finish, count }) => {
      await page.evaluate(() => { window.failSave = true; });
      assert.equal(await userChange('setSource', 'cbnu', false), false); await delay(350); assert.equal(await count(), 1);
      await page.evaluate(() => { window.failSave = false; });
      assert.equal(await userChange('retrySave', 'preferences.enabled_sources.cbnu'), true); await waitRequests(2);
      assert.equal(await page.evaluate(() => window.requests[1].input.preferences.enabled_sources.cbnu), false);
      assert.equal(await page.evaluate(() => window.app.events.length), 0);
      await finish(1, '출처 변경 추천');
    });
    await run('자동 최신화의 429는 다른 입력의 이전 추천을 복원하지 않는다', async ({ page, change, waitRequests, count }) => {
      await change('saveBookmark', 'a', true); await waitRequests(2);
      assert.equal(await page.evaluate(() => window.requests[1].refresh), false);
      await page.evaluate(() => window.requests[1].reject(429)); await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 0);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('notiai:planner:v1:a@example.test:priority')), null);
      await delay(350); assert.equal(await count(), 2);
    });
    await run('실패한 저장과 무관한 설정 변경은 진행 중 추천을 중복 요청하지 않는다', async ({ page, userChange, waitRequests, finish, count }) => {
      await userChange('updateProfile', { grade: 4 }); await waitRequests(2);
      await userChange('setNotification', 'email', false);
      await page.evaluate(() => { window.failSave = true; });
      await userChange('updateProfile', { major: '실패할 전공' }); await delay(350); assert.equal(await count(), 2);
      await finish(1, '진행 중 추천');
    });
    await run('저장 성공 뒤 재조회 실패 시 이전 추천을 숨기고 조회 복구 후 최신화한다', async ({ page, change, waitRequests, finish, count }) => {
      await page.evaluate(() => { window.failRead = true; });
      assert.equal(await change('saveBookmark', 'a', true), false);
      await page.getByRole('alert').waitFor();
      await delay(350); assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 0); assert.equal(await count(), 1);
      await page.evaluate(() => { window.failRead = false; });
      await page.getByRole('button', { name: '다시 시도' }).click(); await waitRequests(2); await finish(1, '조회 복구 추천');
    });
    await run('이전 비동기 응답은 새 화면과 캐시를 덮어쓰지 않는다', async ({ page, userChange, waitRequests, finish }) => {
      await userChange('updateProfile', { grade: 4 }); await waitRequests(2);
      await userChange('updateProfile', { grade: 5 }); await waitRequests(3); await finish(2, '최신 추천');
      await page.evaluate(() => window.requests[1].resolve('오래된 추천')); await delay(150);
      assert.equal(await page.getByRole('button', { name: /오래된 추천/ }).count(), 0);
      const stored = await page.evaluate(() => sessionStorage.getItem('notiai:planner:v1:a@example.test:priority'));
      assert.match(stored, /최신 추천/); assert.doesNotMatch(stored, /오래된 추천/);
    });
    await run('로그아웃·계정 변경은 이전 결과와 진행 중 응답을 노출하지 않는다', async ({ page, userChange, waitRequests, finish }) => {
      await userChange('updateProfile', { grade: 4 }); await waitRequests(2);
      await userChange('resetAccount'); await delay(350);
      assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 0);
      await page.evaluate(() => { window.remote.profile.email = 'b@example.test'; });
      await userChange('reloadUser'); await waitRequests(3); await finish(2, '다른 계정 추천');
      await page.evaluate(() => window.requests[1].resolve('이전 계정 추천')); await delay(150);
      assert.equal(await page.getByRole('button', { name: /이전 계정 추천/ }).count(), 0);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('notiai:planner:v1:a@example.test:priority')), null);
      assert.match(await page.evaluate(() => sessionStorage.getItem('notiai:planner:v1:b@example.test:priority')), /다른 계정 추천/);
    });
    await run('reset 없이 계정을 다시 조회해도 이전 계정의 늦은 저장 성공을 반영하지 않는다', async ({ page, userChange, waitRequests, finish, count }) => {
      await page.evaluate(() => { window.holdSaves = true; window.user.updateProfile({ grade: 6 }); });
      await page.waitForFunction(() => window.saves.length === 1);
      await page.evaluate(() => { window.remote.profile = { ...window.remote.profile, email: 'b@example.test', major: '다른 계정', grade: 2 }; });
      await userChange('reloadUser'); await waitRequests(2); await finish(1, '계정 B 추천');
      await page.evaluate(() => window.saves.shift()()); await delay(350);
      assert.equal(await count(), 2); assert.equal(await page.getByRole('button', { name: /계정 B 추천/ }).count(), 1);
      assert.equal(await page.evaluate(() => window.user.profile.grade), 2);
    });
    await run('실제 설정 화면의 로그아웃 성공만 사용자와 추천 캐시를 초기화한다', async ({ page }) => {
      await page.evaluate(() => { window.navigate('/settings'); window.failSave = true; });
      await page.getByRole('button', { name: '로그아웃', exact: true }).click();
      await page.getByText('로그아웃하지 못했어요. 다시 시도해 주세요.').waitFor();
      assert.equal(await page.evaluate(() => window.user.profile.email), 'a@example.test');
      assert.ok(await page.evaluate(() => sessionStorage.getItem('notiai:planner:v1:a@example.test:priority')));
      await page.evaluate(() => { window.failSave = false; });
      await page.getByRole('button', { name: '로그아웃', exact: true }).click(); await page.getByText('다른 화면').waitFor();
      assert.equal(await page.evaluate(() => window.user.profile.email), '');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('notiai:planner:v1:a@example.test:priority')), null);
      await page.evaluate(() => window.navigate('/planner?mode=priority')); await delay(350);
      assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 0);
    });
    await run('수동 새로 받기의 refresh·429 이전 결과·재시도 정책을 보존한다', async ({ page, waitRequests, finish }) => {
      await page.getByRole('button', { name: '새로 받기' }).click(); await waitRequests(2);
      assert.equal(await page.evaluate(() => window.requests[1].refresh), true);
      await page.evaluate(() => window.requests[1].reject(429));
      await page.getByText('잠시 후 다시 시도해 주세요.').waitFor();
      assert.equal(await page.getByRole('button', { name: /최초 추천/ }).count(), 1);
      assert.equal(await page.getByRole('button', { name: '새로 받기' }).isDisabled(), true);
      await delay(5100); await page.getByRole('button', { name: '새로 받기' }).click(); await waitRequests(3);
      await page.evaluate(() => window.requests[2].reject(503)); await page.getByRole('alert').waitFor();
      await page.getByRole('button', { name: '다시 시도' }).click();
      await page.getByRole('button', { name: /최초 추천/ }).waitFor();
      assert.equal(await page.evaluate(() => window.requests.length), 3);
    });
  } finally { await browser?.close(); await server.close(); }
});
