import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('내 신고: 상태·공유 사유 라벨, 빈 목록·로딩·실패·삭제된 일정·메모·10건 표시', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, ws: false }, plugins: [react()], define: { 'import.meta.env.VITE_USE_MOCK': '"true"' } });
  try {
    const { MyReportsContent: Content, REPORT_STATUS_LABELS } = await server.ssrLoadModule('/src/components/MyReports.jsx');
    const { REPORT_REASONS } = await server.ssrLoadModule('/src/utils/settings.js');
    const { listMyReports } = await server.ssrLoadModule('/src/services/reportService.js');
    const reports = await listMyReports();
    assert.deepEqual(reports.map(item => item.status), ['received', 'resolved']);
    assert.deepEqual(REPORT_STATUS_LABELS, { received: '접수됨', resolved: '처리됨' });
    const render = props => renderToStaticMarkup(React.createElement(Content, { reports, status: 'ready', limit: 10, onRetry() {}, ...props }));
    const markup = render();
    for (const label of Object.values(REPORT_STATUS_LABELS)) assert.ok(markup.includes(label));
    assert.match(markup, /관리자가 확인하고 일정을 반영했어요/);
    assert.match(markup, /원문에는.*\n날짜를 확인해 주세요/);
    for (const [reason, label] of REPORT_REASONS) assert.ok(render({ reports: [{ ...reports[0], reason }] }).includes(`신고 사유: ${label}`));
    assert.match(render({ reports: [{ ...reports[0], title: null, memo: '' }] }), /삭제된 일정/);
    assert.doesNotMatch(render({ reports: [{ ...reports[0], memo: '' }] }), /my-report-memo/);
    const empty = render({ reports: [] });
    assert.match(empty, /보낸 일정 신고가 없어요. 일정 상세에서 날짜·내용이 틀리면 신고할 수 있어요./);
    assert.doesNotMatch(empty, /<section/);
    assert.match(render({ status: 'loading' }), /role="status".*불러오는 중/);
    assert.match(render({ status: 'error' }), /role="alert".*불러오지 못했어요.*다시 시도/);
    assert.doesNotMatch(render({ status: 'error', reports: [] }), /보낸 일정 신고가 없어요/);
    const many = render({ reports: Array.from({ length: 11 }, (_, i) => ({ ...reports[0], id: i })) });
    assert.equal((many.match(/<article /g) || []).length, 10);
    assert.match(many, /더 보기/);
  } finally { await server.close(); }
});

test('내 신고 실제 API는 GET·세션 쿠키·서버 순서를 유지하고 실패를 전달한다', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, ws: false }, define: { 'import.meta.env.VITE_USE_MOCK': '"false"', 'import.meta.env.VITE_API_BASE_URL': '""' } });
  const originalFetch = globalThis.fetch;
  try {
    const { listMyReports } = await server.ssrLoadModule('/src/services/reportService.js');
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/reports/mine'); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include');
      return { ok: true, status: 200, json: async () => [{ id: 4 }, { id: 9 }] };
    };
    assert.deepEqual(await listMyReports(), [{ id: 4 }, { id: 9 }]);
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ message: '일시 오류' }) });
    await assert.rejects(listMyReports(), /일시 오류/);
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
