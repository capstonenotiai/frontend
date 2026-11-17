import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const options = { configFile: false, envDir: false, server: { host: '127.0.0.1', port: 0 } };
test('관리자 mock API: counts·페이지·신고 처리·revision·의견 type 계약', async () => {
  const server = await createServer({ ...options, define: { 'import.meta.env.VITE_USE_MOCK': '"true"' } });
  try {
    const admin = await server.ssrLoadModule('/src/services/adminService.js');
    const counts = await admin.getCounts();
    assert.equal(counts.all, 34); assert.equal(counts.needs_review, 32); assert.equal(counts.reported, 1);
    const page = await admin.getQueue('needs_review', 30); assert.equal(page.total, 32); assert.equal(page.items.length, 2); assert.ok(page.items[0].reason); assert.ok(page.items[0].crawled_at);
    const reported = await admin.getQueue('reported', 0); assert.equal(reported.items[0].open_report_count, 1);
    const notice = await admin.getNotice(2); assert.equal(notice.reports[0].resolved_at, null); assert.ok(notice.reports[0].created_at);
    const save = await admin.reviewNotice(2, { revision: notice.revision, action: 'save', reason: '확인 중', events: notice.events }); assert.equal(save.resolved_reports, 0); assert.equal((await admin.getCounts()).reported, 1);
    await assert.rejects(admin.reviewNotice(2, { revision: notice.revision, action: 'approve', events: notice.events }), e => e.status === 409);
    const approve = await admin.reviewNotice(2, { revision: save.revision, action: 'approve', reason: '확인 완료', events: notice.events }); assert.equal(approve.resolved_reports, 1); assert.equal((await admin.getCounts()).reported, 0); assert.ok((await admin.getNotice(2)).reports[0].resolved_at);
    notice.events[0].title = '복사본 수정'; assert.notEqual((await admin.getNotice(2)).events[0].title, notice.events[0].title);
    const feedback = await admin.getFeedback(0, 'inconvenience'); assert.equal(feedback.total, feedback.counts.inconvenience); assert.ok(feedback.items.every(f => f.type === 'inconvenience')); assert.equal(feedback.counts.all, 54);
    assert.equal((await admin.getFeedback(50, 'all')).items.length, 4);
    await assert.rejects(admin.getNotice(999), e => e.status === 404);
  } finally { await server.close(); }
});

test('관리자 실제 API: counts·쿼리·필터·revision 본문·signal', async () => {
  const server = await createServer({ ...options, define: { 'import.meta.env.VITE_USE_MOCK': '"false"' } });
  const original = globalThis.fetch, requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return { ok: true, status: 200, json: async () => ({}) }; };
  try {
    const admin = await server.ssrLoadModule('/src/services/adminService.js'), signal = new AbortController().signal;
    await admin.getCounts(signal); await admin.getQueue('reported', 30, signal); await admin.getNotice(2, signal); await admin.getFeedback(50, 'suggestion', signal); await admin.getFeedback(0, 'all', signal); await admin.reviewNotice(2, { revision: 3, action: 'save', reason: '확인', events: [] });
    assert.deepEqual(requests.map(r => r.url), ['/api/admin/notices/counts', '/api/admin/notices?state=reported&offset=30', '/api/admin/notices/2', '/api/admin/feedback?limit=50&offset=50&type=suggestion', '/api/admin/feedback?limit=50&offset=0', '/api/admin/notices/2/review']);
    assert.ok(requests.slice(0, 5).every(r => r.signal === signal && r.credentials === 'include')); assert.equal(JSON.parse(requests[5].body).revision, 3); assert.equal(requests[5].method, 'POST');
  } finally { globalThis.fetch = original; await server.close(); }
});
