import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { writePlannerCache, plannerUserInputKey, plannerEventInputKey } from '../src/utils/planner.js';

test('플래너·채팅: 실제 API 요청 계약과 오류 상태를 네트워크 없이 확인한다', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, ws: false },
    define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_PLANNER_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' }, optimizeDeps: { noDiscovery: true, include: [] } });
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options, body: JSON.parse(options.body) }); return { ok: true, status: 200, json: async () => url.endsWith('/chat') ? { reply: '답변' } : { mode: 'focus', items: [] } }; };
  try {
    const service = await server.ssrLoadModule('/src/services/plannerService.js');
    const controller = new AbortController();
    await service.getRecommendations('focus', { signal: controller.signal });
    assert.equal(requests[0].url, '/api/planner/recommendations'); assert.deepEqual(requests[0].body, { mode: 'focus' });
    assert.equal(requests[0].credentials, 'include'); assert.equal(requests[0].signal, controller.signal);
    await service.getRecommendations('focus', { refresh: true });
    assert.deepEqual(requests.pop().body, { mode: 'focus', refresh: true });
    const history = Array.from({ length: 20 }, (_, index) => service.createMessage(index % 2 ? 'assistant' : 'user', `과거 ${index}`));
    const reply = await service.sendMessage({ message: '이번 질문', history, modeId: 'priority' });
    assert.deepEqual(reply.content, ['답변']); assert.equal(requests[1].url, '/api/planner/chat');
    assert.equal(requests[1].body.message, '이번 질문'); assert.equal(requests[1].body.history.length, 12);
    assert.equal(requests[1].body.history[0].content, '과거 8'); assert.ok(!Object.hasOwn(requests[1].body, 'mode'));
    for (const status of [400, 401, 413, 429, 500, 502, 503]) {
      globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ message: '검증 오류' }) });
      await assert.rejects(service.getRecommendations('priority'), (error) => error.status === status);
    }
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});

test('플래너·공통 채팅 SSR: 모드 고르기·저장 결과 복원·접힌 묶음·빈 상태·오류·공통 레이아웃', async () => {
  const server = await createServer({ configFile: false, envDir: false, plugins: [{ name: 'planner-fixture', enforce: 'pre', load(id) {
    const path = id.replaceAll('\\', '/');
    if (path.endsWith('/src/context/AppDataContext.jsx')) return 'export function useAppData() { return globalThis.__plannerApp; }';
    if (path.endsWith('/src/context/UserContext.jsx')) return 'export function useUser() { return globalThis.__plannerUser; }';
  } }, react()], server: { middlewareMode: true, ws: false }, define: { 'import.meta.env.VITE_USE_MOCK': '"true"' }, optimizeDeps: { noDiscovery: true, include: [] } });
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map(); const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  globalThis.__plannerApp = { events: [{ id: 'a', title: '장학 공지', registered: true, bookmarked: true, is_new: true }], calendarEvents: [{ id: 'a', registered: true }], hiddenEvents: [], status: 'ready', summary: {}, refresh() {} };
  globalThis.__plannerUser = { profile: { name: '검증 사용자', email: 'fixture', major: '소프트웨어학부', grade: 3, enrollment_status: 'enrolled' }, preferences: { interests: ['career'], enabled_sources: {}, notifications: {} }, status: 'ready' };
  globalThis.__plannerApp.plannerEventKey = plannerEventInputKey(globalThis.__plannerApp.events, globalThis.__plannerApp.calendarEvents);
  globalThis.__plannerUser.plannerUserKey = plannerUserInputKey(globalThis.__plannerUser.profile, globalThis.__plannerUser.preferences);
  const render = (Component, props = {}, url = '/planner') => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Component, props)));
  try {
    const { default: Planner, PlannerResults, PlannerLoading, PlannerError } = await server.ssrLoadModule('/src/pages/PlannerPage.jsx');
    const intro = render(Planner);
    assert.match(intro, /어떤 도움이 필요한가요/); assert.equal((intro.match(/class="planner-mode"/g) || []).length, 3);
    assert.match(intro, /내 일정 1건 · 새 공지 1건/); assert.match(intro, /소프트웨어학부 · 3학년 · 재학/); assert.match(intro, /진로·취업/);
    assert.doesNotMatch(intro, /Study|Explorer|Balanced|7일 브리핑|ai-chat-panel/);
    const data = { mode: 'focus', generated_at: new Date().toISOString(), items: [{ opportunity_id: 'o1', title: '핵심 공지', tier: 'core', reason: '먼저 볼 이유', focus_event_id: 'a', days_until_deadline: 3 }, { opportunity_id: 'o2', title: '접힌 공지', tier: 'secondary', reason: '미룰 이유', secondary_reason: 'schedule_conflict' }], needs_grouping_check: [{ opportunity_id: 'o3', title: '묶음 확인 공지' }], corrections: ['internal_correction'] };
    writePlannerCache(storage, 'focus', 'fixture', data, JSON.stringify([globalThis.__plannerUser.plannerUserKey, globalThis.__plannerApp.plannerEventKey]));
    const restored = render(Planner, {}, '/planner?mode=focus');
    assert.match(restored, /핵심 공지/); assert.match(restored, /후순위 1건/); assert.match(restored, /같은 공지인지 확인이 필요한 항목 1건/);
    assert.doesNotMatch(restored, /접힌 공지|묶음 확인 공지|internal_correction|planner-placeholder/);
    assert.match(restored, /aria-expanded="false"/); assert.match(restored, />새로 받기</); assert.match(restored, /30분 동안 저장/);
    assert.equal((render(PlannerLoading).match(/class="planner-placeholder"/g) || []).length, 3);
    assert.match(render(PlannerLoading), /role="status"/);
    assert.match(render(PlannerError, { error: { status: 502 }, onRetry() {} }), /AI 응답을 받지 못했어요/);
    assert.match(render(PlannerResults, { mode: 'discover', data: { items: [] }, events: [] }), /전체 공지 보기/);
    const { default: Chat } = await server.ssrLoadModule('/src/components/ChatPanel.jsx');
    const chat = render(Chat);
    assert.match(chat, /채팅 열기/); assert.match(chat, /hidden="" role="dialog"/); assert.match(chat, /내 일정에 대해 묻기/);
    assert.match(chat, /마감 전 일정 20건/); assert.doesNotMatch(chat, /Study|Explorer|Balanced|GPT-4/);
    const { default: Layout } = await server.ssrLoadModule('/src/layouts/AppLayout.jsx');
    for (const url of ['/dashboard', '/schedules', '/schedules/saved', '/schedules/hidden', '/planner', '/calendar', '/settings', '/feedback', '/admin/review']) assert.match(render(Layout, {}, url), /aria-label="채팅 열기"/);
    const { default: Settings } = await server.ssrLoadModule('/src/pages/SettingsPage.jsx');
    assert.doesNotMatch(render(Settings, {}, '/settings'), /기본 모드|자동 모드 추천/);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage); else delete globalThis.sessionStorage;
    delete globalThis.__plannerApp; delete globalThis.__plannerUser; await server.close();
  }
});

test('플래너 mock: 세 API 응답의 앱 ID·접힌 항목·묶음 확인과 취소·오류 스위치', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, ws: false }, define: { 'import.meta.env.VITE_USE_MOCK': '"true"', 'import.meta.env.VITE_PLANNER_USE_MOCK': '"true"' }, optimizeDeps: { noDiscovery: true, include: [] } });
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  try {
    const { buildMockRecommendations } = await server.ssrLoadModule('/src/data/mockPlanner.js');
    const { mockStore } = await server.ssrLoadModule('/src/services/mockStore.js');
    const service = await server.ssrLoadModule('/src/services/plannerService.js');
    for (const mode of ['priority', 'discover', 'focus']) {
      const data = buildMockRecommendations(mode, mockStore.events);
      assert.equal(data.mode, mode); assert.ok(data.needs_grouping_check.length > 0);
      assert.ok(data.items.every((item) => mockStore.events.some((event) => event.id === item.focus_event_id)));
      if (mode === 'discover') assert.ok(data.items.some((item) => item.grade === 'not_recommended'));
      if (mode === 'focus') assert.deepEqual(data.items.filter((item) => item.tier === 'secondary').map((item) => item.secondary_reason), ['stronger_alternative', 'schedule_conflict', 'information_uncertain']);
    }
    const controller = new AbortController(); controller.abort();
    await assert.rejects(service.getRecommendations('priority', { signal: controller.signal }), (error) => error.name === 'AbortError');
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem() { return '503'; } } });
    await assert.rejects(service.getRecommendations('priority'), (error) => error.status === 503);
    await assert.rejects(service.sendMessage({ message: '/error' }));
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage); else delete globalThis.sessionStorage;
    await server.close();
  }
});
