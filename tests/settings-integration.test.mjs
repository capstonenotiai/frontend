import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
const serverOptions = { configFile: false, envDir: false, server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } };

test('설정·피드백 실제 API: 경로·본문·세션·404/405 메시지와 다른 오류 보존', async () => {
  const server = await createServer({ ...serverOptions, define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' } });
  const originalFetch = globalThis.fetch; const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined }); return { ok: true, status: url.endsWith('logout') ? 204 : 200, json: async () => ({ saved: true }) }; };
  try {
    const user = await server.ssrLoadModule('/src/services/userService.js');
    const event = await server.ssrLoadModule('/src/services/eventService.js');
    const feedback = await server.ssrLoadModule('/src/services/feedbackService.js');
    await user.getProfile(); await user.getPreferences();
    await user.updateProfile({ name: '제외', major: '학부', grade: 3, enrollment_status: 'enrolled' });
    await user.updatePreferences({ ai_mode: 'focus', auto_mode_recommend: false, interests: ['contest'], enabled_sources: {}, notifications: { email: false } });
    await event.reportEvent('id/a', 'location', '장소 확인');
    await feedback.sendFeedback({ type: 'suggestion', message: '기능 의견', replyEmail: 'fixture@example.test' });
    await user.logout();
    assert.deepEqual(requests.map(request => request.url), ['/api/user', '/api/user/preferences', '/api/user/profile', '/api/user/preferences', '/api/events/id%2Fa/reports', '/api/feedback', '/api/auth/logout']);
    assert.deepEqual(requests[2].body, { major: '학부', grade: 3, enrollment_status: 'enrolled' });
    assert.equal(requests[3].method, 'PUT'); assert.equal(Object.hasOwn(requests[3].body, 'ai_mode'), false); assert.equal(Object.hasOwn(requests[3].body, 'auto_mode_recommend'), false);
    assert.deepEqual(requests[3].body.notifications, { d3: true, d1: true, email: false });
    assert.deepEqual(requests[4].body, { reason: 'location', memo: '장소 확인' }); assert.equal(requests[4].method, 'POST');
    assert.deepEqual(requests[5].body, { type: 'suggestion', message: '기능 의견', reply_email: 'fixture@example.test' });
    assert.equal(requests[6].body, undefined); assert.equal(requests[6].method, 'POST'); assert.ok(requests.every(request => request.credentials === 'include'));
    for (const status of [404, 405, 500]) {
      globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ message: '서버 오류' }) });
      await assert.rejects(feedback.sendFeedback({ type: 'other', message: '의견' }), error => error.status === status && error.message === (status === 500 ? '서버 오류' : '아직 의견을 받을 수 없어요. 곧 열게요.'));
    }
    const count = requests.length;
    await assert.rejects(event.reportEvent('a', 'wrong', '')); await assert.rejects(user.updateProfile({ grade: '3' })); assert.equal(requests.length, count);
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});

test('mock 저장: AI 값 보존·고의 실패와 재시도·출처 목록/알림 제외·신고/의견', async () => {
  const server = await createServer({ ...serverOptions, define: { 'import.meta.env.VITE_USE_MOCK': '"true"' } });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map(); Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: key => values.get(key) } });
  try {
    const user = await server.ssrLoadModule('/src/services/userService.js'); const { mockStore } = await server.ssrLoadModule('/src/services/mockStore.js');
    const events = await server.ssrLoadModule('/src/services/eventService.js'); const notifications = await server.ssrLoadModule('/src/services/notificationService.js');
    mockStore.preferences.ai_mode = 'focus'; mockStore.preferences.auto_mode_recommend = false;
    const next = { ...mockStore.preferences, enabled_sources: { cbnu: true, wevity: false, contestkorea: false }, notifications: { d3: false, d1: true, email: false } };
    values.set('notiai:settings:mock-error', '1');
    await assert.rejects(user.updatePreferences(next), error => error.status === 503); assert.equal(mockStore.preferences.enabled_sources.wevity, true);
    await assert.rejects(user.updateProfile({ major: '검증학부', grade: 2, enrollment_status: 'leave' }));
    values.delete('notiai:settings:mock-error');
    await user.updatePreferences(next); await user.updateProfile({ major: '검증학부', grade: 2, enrollment_status: 'leave' });
    assert.equal(mockStore.preferences.ai_mode, 'focus'); assert.equal(mockStore.preferences.auto_mode_recommend, false);
    assert.equal((await user.getProfile()).major, '검증학부'); assert.equal((await user.getPreferences()).notifications.d3, false);
    assert.ok((await events.getEvents()).every(event => event.source === 'cbnu'));
    const list = await notifications.listNotifications();
    assert.ok(list.items.every(item => mockStore.events.find(event => event.id === item.event_id)?.source === 'cbnu'));
    assert.equal((await notifications.getUnreadCount()).count, list.items.filter(item => !item.read).length);
    assert.equal((await events.reportEvent('ev1', 'date', '')).saved, true);
    const feedback = await server.ssrLoadModule('/src/services/feedbackService.js'); assert.ok((await feedback.sendFeedback({ type: 'praise', message: '의견' })).created_at);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor); else delete globalThis.sessionStorage; await server.close(); }
});

test('설정·피드백·첫 로그인 SSR: 상태·접근성·URL 탭·공유 부품·앱 경로', async () => {
  const server = await createServer({ ...serverOptions, plugins: [{ name: 'settings-fixture', enforce: 'pre', load(id) {
    const path = id.replaceAll('\\', '/');
    if (path.endsWith('/src/context/UserContext.jsx')) return 'export function useUser() { return globalThis.__settingsUser; }';
    if (path.endsWith('/src/context/AppDataContext.jsx')) return 'export function useAppData() { return globalThis.__settingsApp; }';
  } }, react()], define: { 'import.meta.env.VITE_USE_MOCK': '"true"' } });
  globalThis.__settingsUser = { status: 'ready', profile: { name: '검증 사용자', email: 'fixture@example.test', major: '학부', grade: 2, enrollment_status: 'leave' }, preferences: { interests: [], enabled_sources: { cbnu: true, wevity: false, contestkorea: false }, notifications: { d3: true, d1: false, email: true } }, saveStates: { 'profile.major': 'saving', 'profile.grade': 'saved', 'preferences.interests': 'error' } };
  globalThis.__settingsApp = { events: [], calendarEvents: [], hiddenEvents: [], status: 'ready', summary: {} };
  const render = (Component, props = {}, url = '/settings') => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Component, props)));
  try {
    const { default: Settings } = await server.ssrLoadModule('/src/pages/SettingsPage.jsx');
    const markup = render(Settings); assert.equal((markup.match(/class="settings-section"/g) || []).length, 5);
    assert.match(markup, /저장 중…/); assert.match(markup, /저장됨/); assert.match(markup, /저장하지 못했어요/); assert.match(markup, /다시 시도/);
    assert.match(markup, /aria-label="전공"/); assert.match(markup, /maxLength="255"/); assert.match(markup, /하나 이상 켜 두어야 해요/);
    assert.match(markup, /aria-label="충북대 포털"[^>]*disabled/); assert.equal((markup.match(/role="switch"/g) || []).length, 6);
    assert.doesNotMatch(markup, /기본 모드|자동 모드 추천|Google 재연결|d7|new_event/);
    assert.match(markup, />계정 삭제</);
    globalThis.__settingsUser.status = 'loading'; assert.match(render(Settings), /설정을 불러오는 중/);
    globalThis.__settingsUser.status = 'error'; assert.match(render(Settings), /설정을 불러오지 못했어요/);
    globalThis.__settingsUser.status = 'ready';
    const { default: Feedback } = await server.ssrLoadModule('/src/pages/FeedbackPage.jsx');
    const report = render(Feedback, {}, '/feedback?tab=report'); assert.match(report, /role="tablist"/); assert.match(report, /id="feedback-tab-report"[^>]*aria-selected="true"/);
    assert.match(report, /aria-label="신고할 공지 찾기"/); assert.equal((report.match(/feedback-step-number/g) || []).length, 3); assert.match(report, /disabled=""[^>]*>신고하기/);
    assert.equal((report.match(/type="radio"/g) || []).length, 5); assert.match(report, /maxLength="2000"/);
    const opinion = render(Feedback, {}, '/feedback?tab=opinion'); assert.match(opinion, /id="feedback-tab-opinion"[^>]*aria-selected="true"/);
    assert.equal((opinion.match(/type="radio"/g) || []).length, 4); assert.match(opinion, /type="checkbox" checked/); assert.match(opinion, /aria-label="의견 내용"/); assert.match(opinion, /답변을 fixture@example.test로 받을게요/);
    const { default: Welcome } = await server.ssrLoadModule('/src/pages/WelcomePage.jsx'); const welcome = render(Welcome, {}, '/welcome');
    assert.match(welcome, /NotiAI/); assert.match(welcome, /1\/3/); assert.doesNotMatch(welcome, /sidebar|topbar|채팅 열기/);
    const { ProfileFields, NotificationFields } = await server.ssrLoadModule('/src/components/SettingsFields.jsx');
    const fields = render(ProfileFields, { profile: globalThis.__settingsUser.profile, disabled: true }); assert.match(fields, /재학 상태/); assert.match(fields, /졸업 예정/); assert.match(fields, /fieldset disabled/);
    const switches = render(NotificationFields, { notifications: { d3: true, d1: false, email: false }, email: 'fixture@example.test', disabled: true }); assert.equal((switches.match(/role="switch"/g) || []).length, 3); assert.match(switches, /마감 하루 전/);
    const { default: App } = await server.ssrLoadModule('/src/App.jsx'); assert.match(render(App, {}, '/welcome'), /welcome-page/); assert.doesNotMatch(render(App, {}, '/welcome'), /sidebar|topbar/);
  } finally { delete globalThis.__settingsUser; delete globalThis.__settingsApp; await server.close(); }
});
