import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

test('캘린더·읽기 전용 타임라인·기존 공지 화면의 SSR 회귀를 확인한다', async () => {
  const server = await createServer({ configFile: false, envDir: false,
    plugins: [{ name: 'calendar-fixture', enforce: 'pre',
      load(id) {
        if (id.replaceAll('\\', '/').endsWith('/src/context/AppDataContext.jsx')) {
          return 'export function useAppData() { return globalThis.__calendarFixture; }';
        }
      },
    }, react()],
    server: { middlewareMode: true, ws: false },
    define: { 'import.meta.env.VITE_USE_MOCK': '"true"' },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const fixture = {
    events: [], calendarEvents: [], hiddenEvents: [], status: 'ready', summary: {},
    actionBusy: false, refresh() {}, saveBookmark() {}, requestRegistration() {},
    showUndo() {}, setDismissed() {}, setActionStatus() {},
  };
  globalThis.__calendarFixture = fixture;
  const event = (id, extra = {}) => ({ id, title: `공지 ${id}`, start_date: '2026-10-12', end_date: '2026-10-12', registered: true, category: 'academic', ...extra });
  try {
    const { default: Calendar } = await server.ssrLoadModule('/src/pages/CalendarPage.jsx');
    const render = (Component, url = '/calendar?month=2026-10', props = {}) => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Component, props)));
    fixture.calendarEvents = [event('a', { action_status: 'done' }), event('b'), event('c'), event('d'),
      event('saved', { registered: false, bookmarked: true }), event('hidden', { dismissed: true }),
      event('career', { category: 'career' }), event('period', { start_date: '2026-09-25', end_date: '2026-10-06' })];
    const html = render(Calendar);
    assert.equal((html.match(/class="calendar-week"/g) || []).length, 5);
    assert.match(html, /2026년 10월/);
    assert.match(html, /aria-label="10월 12일 월요일"/);
    assert.match(html, /완료한 일정: 공지 a/);
    assert.match(html, /\+2개 더/);
    assert.match(html, /open-left open-right/);
    assert.doesNotMatch(html, /공지 saved|공지 hidden|EventDetailPanel/);
    const filtered = render(Calendar, '/calendar?month=2026-10&off=career');
    assert.doesNotMatch(filtered, /title="공지 career"/);
    assert.match(filtered, /event-category-career" aria-pressed="false"/);
    const allOff = render(Calendar, '/calendar?month=2026-10&off=academic,scholarship,career,contest,activity');
    assert.match(allOff, /모든 분야를 껐어요/);
    assert.match(allOff, /모두 켜기/);
    assert.doesNotMatch(allOff, /title="공지/);
    assert.match(render(Calendar, '/calendar?month=2027-01'), /이번 달에 등록한 일정이 없어요/);
    fixture.status = 'loading';
    assert.match(render(Calendar), /calendar-skeleton/);
    fixture.status = 'error'; fixture.error = { message: '불러오기 실패' };
    assert.match(render(Calendar), /불러오기 실패/);
    assert.match(render(Calendar), /다시 시도/);
    fixture.status = 'ready'; fixture.error = null;

    const { default: Timeline } = await server.ssrLoadModule('/src/components/events/NoticeTimeline.jsx');
    const timelineProps = { items: [event('a', { start_time: '14:00', event_type: 'application' })], currentId: 'a' };
    const readonly = render(Timeline, '/', timelineProps);
    assert.match(readonly, /10\.12\(월\) 14:00/);
    assert.doesNotMatch(readonly, /<button|완료 표시/);
    assert.match(render(Timeline, '/', { ...timelineProps, editable: true }), /수정/);

    const { default: Popover } = await server.ssrLoadModule('/src/components/events/EventPopover.jsx');
    const popover = render(Popover, '/', { event: event('a', { sync_status: 'needs_sync', source_url: 'https://example.com', review_required: true }), onClose() {} });
    assert.match(popover, /role="dialog" aria-labelledby=/);
    assert.match(popover, /aria-label="닫기"/);
    assert.match(popover, /등록 해제/);
    assert.match(popover, /다시 반영/);
    assert.match(popover, /원문 보기/);
    assert.doesNotMatch(popover, /완료 표시|>수정</);

    fixture.events = [event('notice'), event('saved', { registered: false, bookmarked: true })];
    fixture.hiddenEvents = [event('hidden', { dismissed: true })];
    const { default: Schedules } = await server.ssrLoadModule('/src/pages/SchedulesPage.jsx');
    const { default: Saved } = await server.ssrLoadModule('/src/pages/SavedPage.jsx');
    const { default: Hidden } = await server.ssrLoadModule('/src/pages/HiddenPage.jsx');
    const { default: Dashboard } = await server.ssrLoadModule('/src/pages/DashboardPage.jsx');
    assert.match(render(Schedules, '/schedules'), /공지 <strong>2<\/strong>건/);
    assert.match(render(Saved, '/schedules/saved'), /저장 해제/);
    assert.match(render(Hidden, '/schedules/hidden'), /숨김 해제/);
    assert.match(render(Dashboard, '/dashboard'), /이번 주/);
  } finally {
    delete globalThis.__calendarFixture;
    await server.close();
  }
});
