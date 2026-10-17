import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

test('홈 새 공지는 마감을 제외하고 오늘·미확인 날짜를 유지하며 가까운 마감순으로 표시한다', async () => {
  const server = await createServer({ configFile: false, envDir: false,
    plugins: [{ name: 'home-real-data-fixture', enforce: 'pre', load(id) {
      if (id.replaceAll('\\', '/').endsWith('/src/context/AppDataContext.jsx'))
        return 'export function useAppData() { return globalThis.__r09Home; }';
    } }, react()], server: { middlewareMode: true, ws: false },
    define: { 'import.meta.env.VITE_USE_MOCK': '"true"' }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { enrichEvent, compareByDeadline } = await server.ssrLoadModule('/src/utils/events.js');
    const { default: Dashboard } = await server.ssrLoadModule('/src/pages/DashboardPage.jsx');
    const events = [
      ['old', '지난 공지', '2026-05-17'], ['later', '나중 공지', '2026-05-23'],
      ['recent', '어제 공지', '2026-05-18'], ['today', '오늘 공지', '2026-05-19'],
      ['hidden', '숨긴 공지', '2026-05-20'], ['not-new', '기존 공지', '2026-05-20'],
      ['soon', '가까운 공지', '2026-05-20'], ['unknown', '날짜 미확인 공지', ''],
    ].map(([id, title, end_date]) => enrichEvent({ id, title, end_date, source: 'cbnu', is_new: id !== 'not-new', dismissed: id === 'hidden' }));
    globalThis.__r09Home = { events, calendarEvents: [], status: 'ready' };
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Dashboard)));
    assert.doesNotMatch(html, /지난 공지|어제 공지|숨긴 공지|기존 공지/);
    assert.match(html, /home-new-count">4<\/span>/);
    const titles = ['오늘 공지', '가까운 공지', '나중 공지', '날짜 미확인 공지'];
    for (let i = 0; i < titles.length - 1; i++) assert.ok(html.indexOf(titles[i]) < html.indexOf(titles[i + 1]));
    // 캘린더 등 다른 사용처의 날짜 정렬은 그대로다.
    assert.equal([...events].sort(compareByDeadline)[0].id, 'old');
  } finally { delete globalThis.__r09Home; await server.close(); }
});
