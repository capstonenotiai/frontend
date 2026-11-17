import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { dateLines } from '../src/utils/adminReview.js';
const playwright = await import(process.env.MOBILE_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('관리자 날짜 줄: 연도·월일 구분자·경계·강조·유효 날짜', () => {
  const lines = dateLines('접수 2026.10.24 ~ 10월 25일\n제출 10/24, 2026년 10월 24일\n다른 연도 2025-10-24\n오류 13/24 10/32 2026.02.30\n전화 010-1234-5678\n장소 안내', [{ start_date: '2026-10-24' }]);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.flatMap(l => l.parts.filter(p => p.match).map(p => p.text)), ['2026.10.24', '10/24', '2026년 10월 24일']);
});

test('관리자 B안: 경로·쿼리·이전다음·신고·의견·편집 보호·반응형', { skip: !playwright && 'MOBILE_PLAYWRIGHT_MODULE을 지정하세요.', timeout: 120000 }, async t => {
  const server = await createServer({ configFile: false, envDir: false, cacheDir: 'node_modules/.vite-admin-test', server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.VITE_USE_MOCK': '"true"' }, plugins: [{ name: 'admin-fixture', enforce: 'pre', transform(code, id) {
    const file = id.replaceAll('\\', '/');
    if (file.endsWith('/src/data/mockUser.js')) return code.replace('onboarding_done: false', 'onboarding_done: true, is_admin: !window.__adminDenied');
    if (file.endsWith('/src/services/adminService.js')) return code.replaceAll('if (USE_MOCK)', 'if (false)');
  } }, react()] });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.MOBILE_CHROMIUM_EXECUTABLE });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }); page.setDefaultTimeout(8000);
    const errors = [], requests = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    let feedbackMode = 'normal', holdWrite, writeBlocked = false, conflict = false, mutateQueue = false;
    const event = { id: 11, title: '창업경진대회 참가 접수', start_date: '2026-11-02', end_date: '2026-11-20', start_time: '09:00', end_time: '18:00', timezone: 'Asia/Seoul', location: '개신문화관', detail: '참가 신청서를 제출해 주세요.', event_type: 'application', attendance_mode: 'offline', schedule_status: 'confirmed', review_reason: '마감 시각을 원문에서 확인해 주세요.', review_status: 'auto' };
    const notices = Array.from({ length: 34 }, (_, i) => ({ id: i + 1, title: `${i + 1}. 2026 충북대학교 창업경진대회 참가자 모집`, state: i === 1 ? 'approved' : i === 2 ? 'processing' : 'needs_review', source: i === 1 ? 'contestkorea' : 'cbnu', published_at: '2026-10-18', crawled_at: '2026-10-18T00:00:00Z', reason: '마감 시각을 원문에서 확인해 주세요.', open_report_count: i === 1 ? 1 : 0 }));
    const feedback = Array.from({ length: 51 }, (_, i) => ({ id: 51 - i, type: ['suggestion', 'inconvenience', 'praise', 'other'][i % 4], message: i === 50 ? '마지막 의견이에요.' : i ? `서비스 의견 ${i}` : '일정 검수가 편리해졌어요.\n마감 시각도 함께 확인하고 싶어요.', reply_email: i ? null : 'student@example.com', created_at: '2026-10-18T09:00:00+09:00' }));
    const counts = { needs_review: 32, reported: 1, failed: 0, pending: 0, processing: 1, approved: 1, rejected: 0, extracted: 0, all: 34 };
    await page.route('**/api/admin/**', async route => {
      const url = new URL(route.request().url()); requests.push(url.pathname + url.search);
      const json = data => route.fulfill({ json: data });
      if (url.pathname.endsWith('/counts')) return json(counts);
      if (url.pathname.endsWith('/feedback')) {
        if (feedbackMode === 'error') return route.fulfill({ status: 500, json: { message: '의견을 불러오지 못했어요.' } });
        const type = url.searchParams.get('type'), offset = Number(url.searchParams.get('offset'));
        const items = feedbackMode === 'empty' ? [] : feedback.filter(f => !type || f.type === type);
        return json({ total: items.length, counts: { all: 51, inconvenience: 13, suggestion: 13, praise: 13, other: 12 }, items: items.slice(offset, offset + 50) });
      }
      if (url.pathname.endsWith('/review')) {
        writes.push(route.request().postDataJSON());
        if (writeBlocked) await new Promise(resolve => { holdWrite = resolve; });
        if (conflict) return route.fulfill({ status: 409, json: { message: '다른 작업에서 변경되었습니다.' } });
        if (mutateQueue) notices.find(n => n.id === Number(url.pathname.split('/').at(-2))).state = 'approved';
        return json({ id: 2, revision: 3, state: 'approved', resolved_reports: writes.at(-1).action === 'save' ? 0 : 1 });
      }
      const id = Number(url.pathname.split('/').at(-1));
      if (id) return json({ ...notices.find(n => n.id === id), revision: 2, source_url: 'https://example.com/notice', body: '접수: 2026.11.02 ~ 11월 20일 18시까지\n다른 날짜 12/01\n장소: 개신문화관', events: [event], reports: id === 2 ? [{ id: 1, event_id: 11, reason: 'date', memo: '원문에는 마감일이 11월 21일로 나와 있어요.', created_at: '2026-10-18T00:00:00Z', resolved_at: null }, { id: 2, reason: 'other', memo: '지난 신고', created_at: '2026-10-17T00:00:00Z', resolved_at: '2026-10-17T01:00:00Z' }] : [], history: [], model_output: null });
      const state = url.searchParams.get('state'), offset = Number(url.searchParams.get('offset'));
      const items = notices.filter(n => state === 'all' || (state === 'reported' ? n.id === 2 : n.state === state));
      return json({ total: items.length, items: items.slice(offset, offset + 30) });
    });
    const go = async path => { await page.goto(new URL(path, server.resolvedUrls.local[0]).href); await page.locator('.tb-title').waitFor(); };
    const shotDir = 'docs-local/tasks/14-shots'; await mkdir(shotDir, { recursive: true });
    const shot = async name => { await page.evaluate(() => window.scrollTo(0, 0)); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true }); };
    const back = () => page.locator('.admin-back');
    await t.test('개수·전체 폭·URL 복원·상세 이전다음 페이지 경계·뒤로', async () => {
      await go('/admin/review'); await page.locator('.admin-queue-item').first().waitFor();
      assert.equal(await page.locator('.admin-filters button').count(), 9);
      assert.match(await page.locator('.admin-filters').innerText(), /검토 필요\s*32/);
      assert.match(await page.locator('.admin-tabs').innerText(), /서비스 의견\s*51/);
      assert.match(await page.locator('.admin-queue-item').first().innerText(), /마감 시각[\s\S]*충북대 포털[\s\S]*게시/);
      assert.equal(await page.locator('.admin-detail').count(), 0); await shot('1280-review');
      await page.getByRole('button', { name: '다음', exact: true }).click(); await page.waitForURL('**offset=30'); await page.locator('.admin-queue-item').first().waitFor();
      await page.reload(); await page.locator('.admin-queue-item').first().waitFor(); assert.match(page.url(), /offset=30/);
      await page.locator('.admin-queue-item').first().click(); await page.locator('.admin-event').waitFor();
      assert.match(page.url(), /\/admin\/review\/33\?state=needs_review&offset=30/);
      await page.getByRole('button', { name: '이전 공지', exact: true }).click(); await page.waitForURL('**/32?state=needs_review&offset=0'); await page.locator('.admin-event').waitFor();
      await page.getByRole('button', { name: '다음 공지', exact: true }).click(); await page.waitForURL('**/33?state=needs_review&offset=30'); await page.locator('.admin-event').waitFor();
      await back().click(); await page.locator('.admin-queue-item').first().waitFor(); assert.match(page.url(), /state=needs_review&offset=30/);
      await go('/admin/review?state=reported&offset=0'); await page.locator('.admin-queue-item').waitFor(); await shot('1280-reported');
      await page.locator('.admin-queue-item').click(); await page.locator('.admin-reports').waitFor();
      assert.match(await page.locator('.admin-reports').innerText(), /날짜[\s\S]*11월 21일[\s\S]*접수[\s\S]*처리됨/);
      assert.equal(await page.locator('.admin-excerpts mark').count(), 2);
      assert.equal(await page.locator('.admin-excerpts p').count(), 2); await shot('1280-detail');
      await page.getByRole('button', { name: '수집한 원문', exact: true }).click();
      assert.match(await page.locator('.admin-detail > pre').innerText(), /장소: 개신문화관/);
      await page.getByRole('button', { name: '수집한 원문', exact: true }).click();
      await page.getByRole('button', { name: '원문 열기', exact: true }).click();
      assert.equal(await page.getByRole('link', { name: /새 탭에서 원문 열기/ }).getAttribute('href'), 'https://example.com/notice');
    });
    await t.test('의견 type 서버 필터·URL 복원·더 보기·오류·빈 상태', async () => {
      await go('/admin/review?tab=feedback&type=all'); await page.locator('.admin-feedback-item').first().waitFor(); await shot('1280-feedback');
      assert.equal(await page.locator('.admin-feedback-item').count(), 50);
      await page.getByRole('button', { name: '더 보기 (50 / 51)', exact: true }).click(); await page.getByText('마지막 의견이에요.', { exact: true }).waitFor();
      assert.equal(await page.locator('.admin-feedback-item').count(), 51);
      await page.getByRole('button', { name: '불편 13', exact: true }).click(); await page.waitForURL('**type=inconvenience'); await page.locator('.admin-feedback-item').first().waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.admin-feedback-item').length === 13);
      assert.equal(await page.locator('.admin-feedback-item').count(), 13);
      assert.ok(requests.some(url => url.includes('type=inconvenience')));
      await page.reload(); await page.locator('.admin-feedback-item').first().waitFor(); assert.equal(await page.locator('.admin-feedback-item').count(), 13);
      feedbackMode = 'error'; await go('/admin/review?tab=feedback'); await page.locator('.admin-feedback').getByRole('button', { name: '다시 시도', exact: true }).waitFor();
      feedbackMode = 'empty'; await page.locator('.admin-feedback').getByRole('button', { name: '다시 시도', exact: true }).click(); await page.getByText('아직 도착한 의견이 없어요.').waitFor(); feedbackMode = 'normal';
    });
    await t.test('375·320px 목록·상세·의견·가로 넘침·포커스·변경 취소', async () => {
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 900 }); await go('/admin/review?state=reported'); await page.locator('.admin-queue-item').waitFor(); await shot(`${width}-list`);
        await page.locator('.admin-queue-item').click(); await page.locator('.admin-event').waitFor();
        assert.equal(await back().evaluate(n => n === document.activeElement), true);
        assert.equal(await page.locator('.admin-excerpts').getAttribute('open'), null);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0); await shot(`${width}-detail`);
        await page.getByLabel('일정 제목', { exact: true }).fill('변경한 제목');
        assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), true);
        page.once('dialog', d => d.dismiss()); await back().click(); assert.equal(await page.getByLabel('일정 제목', { exact: true }).inputValue(), '변경한 제목');
        page.once('dialog', d => d.accept()); await back().click(); await page.locator('.admin-queue-item').waitFor();
        await page.waitForFunction(() => document.activeElement?.matches('.admin-queue-item'));
        await page.getByRole('button', { name: /서비스 의견/ }).click(); await page.locator('.admin-feedback-item').first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0); await shot(`${width}-feedback`);
      }
    });
    await t.test('필수 사유·중복 저장 잠금·revision·409 보존·신고 처리·거절·processing', async () => {
      await page.setViewportSize({ width: 1280, height: 1000 }); await go('/admin/review/2?state=all&offset=0'); await page.locator('.admin-event').waitFor();
      await page.getByRole('button', { name: '검토 중으로 저장', exact: true }).click(); await page.getByText('검수 사유를 입력해 주세요.', { exact: true }).waitFor(); assert.equal(writes.length, 0);
      await page.getByLabel('검수 사유 (필수)', { exact: true }).fill('원문에서 확인했어요.');
      writeBlocked = true; await page.getByRole('button', { name: '검토 중으로 저장', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.admin-detail fieldset').disabled); assert.equal(await back().isDisabled(), true);
      while (!holdWrite) await new Promise(resolve => setTimeout(resolve, 10)); holdWrite(); writeBlocked = false;
      await page.locator('.admin-success').waitFor(); await page.waitForFunction(() => !document.querySelector('.admin-detail fieldset')?.disabled);
      conflict = true; await page.getByLabel('검수 사유 (필수)').fill('충돌해도 유지'); await page.getByRole('button', { name: '수정 승인 · 신고 처리', exact: true }).click();
      await page.getByText(/입력 내용은 유지했어요/).waitFor(); assert.equal(await page.getByLabel('검수 사유 (필수)').inputValue(), '충돌해도 유지'); conflict = false;
      page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '다음 공지', exact: true }).click(); assert.match(page.url(), /\/2\?/);
      await page.getByRole('button', { name: '수정 승인 · 신고 처리', exact: true }).click(); await page.getByText(/신고 1건을 처리했어요/).waitFor(); assert.match(page.url(), /\/2\?/);
      await page.waitForFunction(() => !document.querySelector('.admin-detail fieldset')?.disabled);
      await page.getByLabel('검수 사유 (필수)').fill('잘못된 일정이에요.'); page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '거절 · 공지 제외', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.admin-detail fieldset')?.disabled);
      assert.deepEqual(writes.map(w => w.action), ['save', 'approve', 'approve', 'reject']); assert.deepEqual(writes[3].events, []); assert.equal(writes[0].revision, 2);
      await go('/admin/review/3?state=processing'); await page.locator('.admin-event').waitFor(); assert.equal(await page.getByRole('button', { name: '승인 및 공개', exact: true }).isDisabled(), true);
      const denied = await browser.newPage(); let adminCalls = 0; await denied.addInitScript(() => { window.__adminDenied = true; }); denied.on('request', r => { if (r.url().includes('/api/admin/')) adminCalls++; });
      await denied.goto(new URL('/admin/review/2', server.resolvedUrls.local[0]).href); await denied.getByText('관리자 계정으로 로그인해 주세요.', { exact: true }).waitFor(); assert.equal(adminCalls, 0); await denied.close();
    });
    await t.test('승인으로 목록이 줄어도 페이지 경계의 다음 공지를 건너뛰지 않는다', async () => {
      await go('/admin/review/32?state=needs_review&offset=0'); await page.locator('.admin-event').waitFor();
      await page.getByLabel('검수 사유 (필수)').fill('경계 공지 승인'); mutateQueue = true;
      await page.getByRole('button', { name: '승인 및 공개', exact: true }).click(); await page.locator('.admin-success').waitFor();
      await page.waitForFunction(() => !document.querySelector('.admin-detail fieldset')?.disabled);
      await page.locator('.admin-success').getByRole('button', { name: '다음 공지', exact: true }).click();
      await page.waitForURL('**/33?state=needs_review&offset=30'); await page.locator('.admin-event').waitFor();
      notices.find(n => n.id === 32).state = 'needs_review'; mutateQueue = false;
    });
    await t.test('홈·공지 1280px 변경 전후 픽셀 동일', async () => {
      const oldCss = execFileSync('git', ['show', 'HEAD:src/styles/admin.css'], { encoding: 'utf8' });
      for (const [path, name] of [['/dashboard', 'home'], ['/schedules', 'notices']]) {
        await go(path); await page.waitForTimeout(500); await page.evaluate(() => document.fonts.ready);
        const after = await page.screenshot({ path: `${shotDir}/1280-${name}-after.png`, fullPage: true });
        const style = await page.addStyleTag({ content: oldCss });
        const before = await page.screenshot({ path: `${shotDir}/1280-${name}-before.png`, fullPage: true }); await style.evaluate(n => n.remove()); assert.deepEqual(before, after);
      }
    });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
