import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { shouldShowWelcome } from '../src/utils/settings.js';
import { clearAccountStorage, emptyAccountState } from '../src/utils/account.js';
import { refreshFailureState, refreshLimitMessage, REFRESH_NOTICE_MS, writePlannerCache, readPlannerCache } from '../src/utils/planner.js';

const options = { configFile: false, envDir: false, server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } };
test('온보딩: 서버 false/true를 우선하고 필드가 없을 때만 기존 판정을 사용한다', () => {
  const profile = { email: 'fixture', major: '', grade: null, enrollment_status: 'unknown' };
  const blocked = { getItem() { throw Error('storage must not be read'); } };
  assert.equal(shouldShowWelcome({ ...profile, major: '학부', onboarding_done: false }, { interests: ['academic'] }, blocked), true);
  assert.equal(shouldShowWelcome({ ...profile, onboarding_done: true }, { interests: [] }, blocked), false);
  assert.equal(shouldShowWelcome(profile, { interests: [] }, { getItem: () => null }), true);
  assert.equal(shouldShowWelcome(profile, { interests: [] }, { getItem: () => '1' }), false);
});

test('계정 초기화: 새로운 빈 상태와 앱 추천 캐시·해당 계정 기록만 비운다', () => {
  const empty = emptyAccountState(); empty.profile.name = 'changed'; empty.preferences.interests.push('academic');
  assert.equal(emptyAccountState().profile.name, ''); assert.deepEqual(emptyAccountState().preferences.interests, []);
  assert.deepEqual(emptyAccountState().saveStates, {});
  const values = new Map([['notiai:planner:v1:fixture:focus', 'result'], ['notiai:planner:v1:fixture:priority', 'result'], ['other', 'keep']]);
  const session = { get length() { return values.size; }, key: i => [...values.keys()][i], removeItem: key => values.delete(key) };
  const local = new Map([['notiai.welcome.done.fixture', '1'], ['notiai.welcome.done.other', '1']]);
  clearAccountStorage('fixture', session, { removeItem: key => local.delete(key) });
  assert.deepEqual([...values], [['other', 'keep']]); assert.deepEqual([...local.keys()], ['notiai.welcome.done.other']);
  assert.doesNotThrow(() => clearAccountStorage('fixture', { get length() { throw Error('blocked'); } }, { removeItem() { throw Error('blocked'); } }));
});

test('TASK_B12 실제 계약: 온보딩 PUT·삭제 DELETE/204·의견 201·내 신고 GET', async () => {
  const server = await createServer({ ...options, define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' } });
  const original = globalThis.fetch, requests = [];
  globalThis.fetch = async (url, config) => {
    requests.push({ url, ...config });
    return { ok: true, status: config.method === 'DELETE' ? 204 : url.endsWith('/feedback') ? 201 : 200,
      json: async () => url.endsWith('/onboarding') ? { onboarding_done: true } : url.endsWith('/feedback') ? { id: 7, created_at: '2026-10-11T00:04:00Z' } : [] };
  };
  try {
    const user = await server.ssrLoadModule('/src/services/userService.js');
    assert.equal((await user.completeOnboarding()).onboarding_done, true);
    assert.equal(await user.deleteAccount(), null);
    const feedback = await server.ssrLoadModule('/src/services/feedbackService.js');
    assert.deepEqual(await feedback.sendFeedback({ type: 'other', message: '의견' }), { id: 7, created_at: '2026-10-11T00:04:00Z' });
    const reports = await server.ssrLoadModule('/src/services/reportService.js'); assert.deepEqual(await reports.listMyReports(), []);
    assert.deepEqual(requests.map(({ url, method }) => [url, method]), [['/api/user/onboarding', 'PUT'], ['/api/users/me', 'DELETE'], ['/api/feedback', 'POST'], ['/api/reports/mine', 'GET']]);
    assert.deepEqual(JSON.parse(requests[0].body), { done: true }); assert.equal(requests[1].body, undefined);
    assert.ok(requests.every(({ credentials }) => credentials === 'include'));
  } finally { globalThis.fetch = original; await server.close(); }
});

test('mock: 온보딩 완료·실패 시 보존·삭제 뒤 프로필/일정/알림 초기화·추천 60초 제한', async () => {
  const server = await createServer({ ...options, define: { 'import.meta.env.VITE_USE_MOCK': '"true"', 'import.meta.env.VITE_PLANNER_USE_MOCK': '"true"' } });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'); let fail = false;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: key => key === 'notiai:settings:mock-error' && fail ? '1' : null } });
  try {
    const user = await server.ssrLoadModule('/src/services/userService.js');
    const { mockStore } = await server.ssrLoadModule('/src/services/mockStore.js');
    assert.equal(mockStore.profile.onboarding_done, false);
    await user.completeOnboarding(); assert.equal(mockStore.profile.onboarding_done, true);
    const planner = await server.ssrLoadModule('/src/services/plannerService.js');
    const first = await planner.getRecommendations('priority', { refresh: true });
    assert.equal(first.items.find(item => item.focus_event_id === 'ev3').days_until_deadline, 3);
    await assert.rejects(planner.getRecommendations('priority', { refresh: true }), error => error.status === 429);
    assert.equal((await planner.getRecommendations('priority')).mode, 'priority');
    fail = true; await assert.rejects(user.deleteAccount()); assert.ok(mockStore.events.length);
    fail = false; await user.deleteAccount();
    assert.deepEqual(mockStore.events, []); assert.deepEqual(mockStore.notifications, []); assert.deepEqual(mockStore.profile, {});
    assert.deepEqual(mockStore.preferences.interests, []);
  } finally { if (original) Object.defineProperty(globalThis, 'sessionStorage', original); else delete globalThis.sessionStorage; await server.close(); }
});

test('429: 결과/캐시 보존·서버 안내/기본 안내·5초·버튼 비활성, summary 무시 SSR', async () => {
  const data = { mode: 'focus', generated_at: new Date().toISOString(), summary: '서버 문장', items: [{ title: '추천', tier: 'core' }] };
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  writePlannerCache(storage, 'focus', 'fixture', data);
  const snapshot = [...values];
  const state = refreshFailureState('focus', data, { status: 429 });
  assert.equal(state.status, 'ready'); assert.equal(state.data, data); assert.deepEqual([...values], snapshot);
  assert.deepEqual(readPlannerCache(storage, 'focus', 'fixture'), data);
  assert.equal(refreshFailureState('focus', data, { status: 503 }).status, 'error');
  assert.equal(refreshLimitMessage({ data: { message: '서버 제한 안내' } }), '서버 제한 안내');
  assert.equal(refreshLimitMessage({ message: '요청 실패 (429)' }), '잠시 후 다시 시도해 주세요.');
  assert.equal(REFRESH_NOTICE_MS, 5000);
  const server = await createServer({ ...options, plugins: [react()], define: { 'import.meta.env.VITE_USE_MOCK': '"true"' } });
  const render = (Component, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)));
  try {
    const { PlannerRefresh, PlannerResults } = await server.ssrLoadModule('/src/pages/PlannerPage.jsx');
    const limited = render(PlannerRefresh, { notice: '서버 제한 안내' });
    assert.match(limited, /disabled=""/); assert.match(limited, /role="status">서버 제한 안내/);
    assert.doesNotMatch(render(PlannerRefresh, {}), /disabled|role="status"/);
    assert.match(render(PlannerRefresh, { loading: true }), /disabled=""/);
    const summary = render(PlannerResults, { mode: 'focus', data, events: [] });
    assert.match(summary, /먼저 집중하고/); assert.doesNotMatch(summary, /서버 문장/);
    const { default: Dialog } = await server.ssrLoadModule('/src/components/DeleteAccountDialog.jsx');
    assert.match(render(Dialog, { triggerRef: { current: null }, onCancel() {}, onDelete() {} }), /role="dialog" aria-modal="true"/);
  } finally { await server.close(); }
});

test('온보딩 화면: 시작하기와 마지막 나중에 하기 모두 완료 PUT 후 홈으로 이동한다', async () => {
  // DOM 없이 실제 화면의 버튼 핸들러·단계 전환을 실행한다. 브라우저 포커스 검증은 별도다.
  const server = await createServer({ ...options, plugins: [{ name: 'welcome-hooks', enforce: 'pre', transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/src/pages/WelcomePage.jsx')) return;
    return code.replace("import { useEffect, useRef, useState } from 'react';", 'const { useEffect, useRef, useState } = globalThis.__welcomeHooks;')
      .replace("import { useNavigate } from 'react-router-dom';", 'const useNavigate = () => globalThis.__welcomeNavigate;')
      .replace("import { useUser } from '../context/UserContext';", 'const useUser = () => globalThis.__welcomeUser;');
  } }, react()], define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' } });
  const original = globalThis.fetch;
  const requests = [], navigations = [];
  globalThis.fetch = async (url, config) => { requests.push({ url, ...config }); return { ok: true, status: 200, json: async () => ({ onboarding_done: true }) }; };
  let index = 0, slots = [], effects = [];
  globalThis.__welcomeHooks = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], next => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }]; },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useEffect(effect) { index++; effects.push(effect); },
  };
  globalThis.__welcomeNavigate = (...args) => navigations.push(args);
  const buttons = node => !node || typeof node !== 'object' ? [] : [
    ...(node.type === 'button' ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(buttons),
  ];
  try {
    const user = await server.ssrLoadModule('/src/services/userService.js');
    globalThis.__welcomeUser = { profile: { email: 'fixture' }, preferences: { interests: [], notifications: {} }, status: 'ready', saveProfileStep: async () => true, savePreferencesStep: async () => true, completeOnboarding: user.completeOnboarding };
    const { default: Welcome } = await server.ssrLoadModule('/src/pages/WelcomePage.jsx');
    const render = () => { index = 0; effects = []; const tree = Welcome(); effects.forEach(effect => effect()); return tree; };
    for (const skip of [false, true]) {
      slots = []; render();
      for (let step = 0; step < 3; step++) {
        const tree = render(); const all = buttons(tree);
        if (step === 1) assert.ok(!all.some(entry => entry.props.className === 'settings-button quiet')); // 관심분야 단계에는 나중에 하기가 없다
        const button = all.find(entry => entry.props.className === (skip && step !== 1 ? 'settings-button quiet' : 'settings-button primary'));
        assert.ok(button); await button.props.onClick();
        assert.equal(requests.length, skip ? (step === 2 ? 2 : 1) : (step === 2 ? 1 : 0));
      }
    }
    assert.deepEqual(requests.map(({ url, method, body }) => [url, method, JSON.parse(body)]), Array(2).fill(['/api/user/onboarding', 'PUT', { done: true }]));
    assert.deepEqual(navigations, Array(2).fill(['/dashboard', { replace: true }]));
  } finally {
    globalThis.fetch = original; delete globalThis.__welcomeHooks; delete globalThis.__welcomeUser; delete globalThis.__welcomeNavigate; await server.close();
  }
});
