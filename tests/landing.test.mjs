import test from 'node:test';
import assert from 'node:assert/strict';
import { getLoginUrl, nextHighlight, LANDING_SCHEDULES, LANDING_NOTICES } from '../src/utils/landing.js';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

test('랜딩 로그인 경로: mock·실제 API·같은 origin', () => {
  assert.equal(getLoginUrl(true, 'https://api.example.test'), '/dashboard');
  assert.equal(getLoginUrl(false, 'https://api.example.test'), 'https://api.example.test/api/auth/google/login');
  assert.equal(getLoginUrl(false, 'https://api.example.test/'), 'https://api.example.test/api/auth/google/login');
  assert.equal(getLoginUrl(false), '/api/auth/google/login');
});

test('자동 강조는 a→b→c→a로 순환하며 멈추면 진행하지 않는다', () => {
  let current = 'a';
  for (const expected of ['b', 'c', 'a', 'b']) { current = nextHighlight(current); assert.equal(current, expected); }
  for (const id of ['a', 'b', 'c']) assert.equal(nextHighlight(id, true), id);
});

test('고정 공지의 모든 날짜는 2026년 11월이며 세 구간이 정확하다', () => {
  assert.deepEqual(LANDING_SCHEDULES.map(({ start, end }) => [start, end]), [
    ['2026-11-10', '2026-11-12'], ['2026-11-17', '2026-11-19'], ['2026-11-24', '2026-11-24'],
  ]);
  const dates = [...LANDING_SCHEDULES.flatMap(item => [item.start, item.end]), ...LANDING_NOTICES.map(item => item.end)];
  assert.ok(dates.length > 0);
  for (const date of dates) {
    assert.match(date, /^2026-11-\d{2}$/);
    assert.equal(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10), date);
  }
});

test('랜딩·정책 SSR: 날짜 연결·Google 버튼 세 곳·메뉴·정책 링크', async () => {
  const server = await createServer({ configFile: false, envDir: false, plugins: [react()], server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, define: { 'import.meta.env.VITE_USE_MOCK': '"true"' } });
  try {
    const Landing = (await server.ssrLoadModule('/src/pages/LandingPage.jsx')).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Landing)));
    assert.match(html, /공지 속 날짜를/);
    assert.equal((html.match(/aria-disabled="false"/g) || []).length, 3);
    assert.equal((html.match(/role="button"/g) || []).length, 13);
    assert.equal((html.match(/class="c"/g) || []).length, 30);
    assert.equal((html.match(/<img /g) || []).length, 3);
    for (const id of ['flow', 'feat', 'sites']) assert.ok(html.includes(`href="#${id}"`) && html.includes(`id="${id}"`));
    assert.match(html, /href="\/privacy"/); assert.match(html, /href="\/terms"/);
    assert.doesNotMatch(html, /예시|데모 보기|새로 받기|통계|logo-slot/);
    const Policy = (await server.ssrLoadModule('/src/pages/PolicyPage.jsx')).default;
    for (const title of ['개인정보처리방침', '이용약관']) {
      const policy = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Policy, { title })));
      assert.ok(policy.includes(title)); assert.match(policy, /준비 중이에요. 곧 공개할게요./); assert.match(policy, /href="\/"/);
      assert.doesNotMatch(policy, /sidebar|topbar/);
    }
  } finally { await server.close(); }
});
