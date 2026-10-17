import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const playwright = await import(process.env.MOBILE_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('관리자 검수: 한국어·신고·의견·모바일·기존 검수 보호', { skip: !playwright && 'MOBILE_PLAYWRIGHT_MODULE을 지정하세요.', timeout: 120000 }, async t => {
  const server = await createServer({ configFile: false, envDir: false, cacheDir: 'node_modules/.vite-admin-test', server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.VITE_USE_MOCK': '"true"' }, plugins: [{ name: 'admin-fixture', enforce: 'pre', transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/src/data/mockUser.js')) return code.replace('onboarding_done: false', 'onboarding_done: true, is_admin: !window.__adminDenied'); } }, react()] });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.MOBILE_CHROMIUM_EXECUTABLE });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [], requests = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    let feedbackMode = 'normal', holdWrite, writeBlocked = false;
    const event = { id: 11, title: '창업경진대회 참가 접수', start_date: '2026-11-02', end_date: '2026-11-20', start_time: '09:00', end_time: '18:00', timezone: 'Asia/Seoul', location: '개신문화관', detail: '참가 신청서를 제출해 주세요.', event_type: 'application', attendance_mode: 'offline', schedule_status: 'confirmed', review_reason: '마감 시각을 원문에서 확인해 주세요.', review_status: 'auto' };
    const notices = [
      { id: 1, title: '2026 충북대학교 창업경진대회 참가자 모집', state: 'needs_review', source: 'cbnu', published_at: '2026-10-18' },
      { id: 2, title: '대학생 공모전 접수 일정 확인 요청', state: 'approved', source: 'contestkorea' },
      { id: 3, title: '추출을 진행하고 있는 공지', state: 'processing', source: 'wevity' },
    ];
    await page.route('**/api/admin/**', async route => {
      const url = new URL(route.request().url()); requests.push(url.pathname + url.search);
      const json = data => route.fulfill({ json: data });
      if (url.pathname.endsWith('/feedback')) {
        if (feedbackMode === 'error') return route.fulfill({ status: 500, json: { message: '의견을 불러오지 못했어요.' } });
        if (feedbackMode === 'empty') return json({ total: 0, items: [] });
        const offset = Number(url.searchParams.get('offset'));
        return json({ total: 51, items: Array.from({ length: offset ? 1 : 50 }, (_, i) => ({ id: 51 - offset - i, type: ['suggestion', 'inconvenience', 'praise', 'other'][i % 4], message: offset ? '마지막 의견이에요.' : i ? `서비스 의견 ${i}` : '일정 검수가 편리해졌어요.\n마감 시각도 함께 확인하고 싶어요.', reply_email: i ? null : 'student@example.com', created_at: '2026-10-18T09:00:00+09:00' })) });
      }
      if (url.pathname.endsWith('/review')) {
        writes.push(route.request().postDataJSON());
        if (writeBlocked) await new Promise(resolve => { holdWrite = resolve; });
        return json({ ok: true });
      }
      const id = Number(url.pathname.split('/').at(-1));
      if (id) return json({ ...notices.find(n => n.id === id), revision: 2, source_url: 'https://example.com/notice', body: '접수: 11월 2일부터 11월 20일 18시까지\n장소: 개신문화관', events: [event], reports: id === 2 ? [{ id: 1, event_id: 11, reason: 'date', memo: '원문에는 마감일이 11월 21일로 나와 있어요.' }] : [], history: [], model_output: null });
      const state = url.searchParams.get('state');
      const items = notices.filter(n => state === 'all' || (state === 'reported' ? n.id === 2 : n.state === state));
      return json({ total: items.length, items });
    });
    const go = async path => { await page.goto(new URL(path, server.resolvedUrls.local[0]).href); await page.locator('.tb-title').waitFor(); };
    const shotDir = 'docs-local/tasks/13-shots'; await mkdir(shotDir, { recursive: true });
    const shot = async name => { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true }); };
    await t.test('한국어 상태·출처와 reported 요청, 신고 카드', async () => {
      await go('/admin/review'); await page.locator('.admin-queue-item').first().click(); await page.locator('.admin-event').waitFor();
      assert.equal(await page.locator('.admin-filters button').count(), 9);
      assert.doesNotMatch(await page.locator('.admin-review').innerText(), /needs_review|cbnu/);
      assert.match(await page.locator('.admin-queue').innerText(), /충북대 포털/);
      await shot('1280-review');
      await page.getByRole('button', { name: '신고됨', exact: true }).click();
      await page.locator('.admin-queue-item').click(); await page.locator('.admin-reports').waitFor();
      assert.ok(requests.some(url => url.includes('state=reported')));
      assert.match(await page.locator('.admin-reports').innerText(), /날짜[\s\S]*11월 21일/);
      await shot('1280-reported');
    });
    await t.test('의견 목록·offset 더 보기·오류 재시도·빈 상태', async () => {
      await page.getByRole('button', { name: '서비스 의견', exact: true }).click();
      await page.locator('.admin-feedback-item').first().waitFor();
      assert.equal(await page.locator('.admin-feedback-item').count(), 50);
      assert.match(await page.locator('.admin-feedback-item').first().innerText(), /제안[\s\S]*student@example.com/);
      await shot('1280-feedback');
      await page.getByRole('button', { name: '더 보기', exact: true }).click();
      await page.getByText('마지막 의견이에요.', { exact: true }).waitFor();
      assert.equal(await page.locator('.admin-feedback-item').count(), 51);
      assert.ok(requests.some(url => url.includes('offset=50')));
      feedbackMode = 'error'; await go('/admin/review'); await page.getByRole('button', { name: '서비스 의견', exact: true }).click();
      await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
      feedbackMode = 'empty'; await page.getByRole('button', { name: '다시 시도', exact: true }).click();
      await page.getByText('아직 도착한 의견이 없어요.').waitFor(); feedbackMode = 'normal';
    });
    await t.test('375·320 목록→상세→뒤로 포커스·수정 버리기 확인', async () => {
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 900 }); await go('/admin/review');
        const trigger = page.locator('.admin-queue-item').first(); await trigger.waitFor();
        assert.ok((await page.locator('.admin-filters').boundingBox()).height < 240);
        await shot(`${width}-list`);
        await trigger.click(); await page.locator('.admin-event').waitFor();
        const back = page.getByRole('button', { name: '목록으로 돌아가기', exact: true });
        assert.equal(await back.evaluate(n => n === document.activeElement), true);
        assert.equal(await page.locator('.admin-queue').isVisible(), false);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
        await shot(`${width}-detail`);
        await page.getByLabel('일정 제목', { exact: true }).fill('변경한 제목');
        page.once('dialog', dialog => dialog.dismiss()); await back.click();
        assert.equal(await page.getByLabel('일정 제목', { exact: true }).inputValue(), '변경한 제목');
        page.once('dialog', dialog => dialog.accept()); await back.click();
        await page.waitForFunction(() => document.activeElement?.matches('.admin-queue-item'));
        assert.equal(await trigger.evaluate(n => n === document.activeElement), true);
        await page.getByRole('button', { name: '서비스 의견', exact: true }).click(); await page.locator('.admin-feedback-item').first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
        await shot(`${width}-feedback`);
      }
    });
    await t.test('검수 사유 필수·중복 저장 잠금·승인·거절·처리 중 잠금', async () => {
      await page.setViewportSize({ width: 1280, height: 1000 }); await go('/admin/review');
      await page.locator('.admin-queue-item').click(); await page.locator('.admin-event').waitFor();
      await page.getByRole('button', { name: '검토 중으로 저장', exact: true }).click();
      await page.getByText('검수 사유를 입력해 주세요.', { exact: true }).waitFor(); assert.equal(writes.length, 0);
      await page.getByLabel('검수 사유 (필수)', { exact: true }).fill('원문에서 확인했어요.');
      writeBlocked = true; await page.getByRole('button', { name: '검토 중으로 저장', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.admin-detail fieldset').disabled);
      assert.equal(await page.getByRole('button', { name: '서비스 의견', exact: true }).isDisabled(), true);
      while (!holdWrite) await new Promise(resolve => setTimeout(resolve, 10)); holdWrite(); writeBlocked = false;
      await page.getByText('검수 결과를 저장했어요.', { exact: true }).waitFor();
      await page.getByLabel('검수 사유 (필수)').fill('승인해요.'); await page.getByRole('button', { name: '승인 및 공개', exact: true }).click();
      await page.waitForTimeout(100); await page.getByLabel('검수 사유 (필수)').fill('잘못된 일정이에요.');
      page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '거절 · 공지 전체 제외', exact: true }).click();
      await page.waitForTimeout(100); assert.deepEqual(writes.map(w => w.action), ['save', 'approve', 'reject']); assert.deepEqual(writes[2].events, []);
      await page.getByRole('button', { name: '처리 중', exact: true }).click(); await page.locator('.admin-queue-item').click(); await page.locator('.admin-event').waitFor();
      assert.equal(await page.getByRole('button', { name: '승인 및 공개', exact: true }).isDisabled(), true);
    });
    await t.test('탭 이동 변경 버리기 확인·저장 후 목록 포커스·일반 사용자 차단', async () => {
      await go('/admin/review'); await page.locator('.admin-queue-item').click(); await page.locator('.admin-event').waitFor();
      await page.getByLabel('검수 사유 (필수)').fill('확인했어요.');
      page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: '서비스 의견', exact: true }).click();
      assert.equal(await page.getByLabel('검수 사유 (필수)').inputValue(), '확인했어요.');
      await page.getByRole('button', { name: '검토 중으로 저장', exact: true }).click();
      await page.getByRole('button', { name: '일정 추가', exact: true }).waitFor();
      await page.waitForTimeout(100);
      await page.setViewportSize({ width: 375, height: 900 });
      await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.matches('.admin-queue-item'));
      assert.equal(await page.locator('.admin-queue-item').evaluate(n => n === document.activeElement), true);
      const denied = await browser.newPage(); let adminCalls = 0;
      await denied.addInitScript(() => { window.__adminDenied = true; });
      denied.on('request', request => { if (request.url().includes('/api/admin/')) adminCalls++; });
      await denied.goto(new URL('/admin/review', server.resolvedUrls.local[0]).href);
      await denied.getByText('관리자 계정으로 로그인해 주세요.', { exact: true }).waitFor();
      assert.equal(await denied.locator('.admin-tabs').count(), 0); assert.equal(adminCalls, 0); await denied.close();
      await page.setViewportSize({ width: 1280, height: 1000 });
    });
    await t.test('홈·공지 1280px 기존 관리자 CSS와 픽셀 동일', async () => {
      const oldCss = execFileSync('git', ['show', 'HEAD:src/styles/admin.css'], { encoding: 'utf8' });
      for (const [path, name] of [['/dashboard', 'home'], ['/schedules', 'notices']]) {
        await go(path); await page.waitForTimeout(500); await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${shotDir}/1280-${name}-after.png`, fullPage: true });
        const style = await page.addStyleTag({ content: oldCss });
        const before = await page.screenshot({ path: `${shotDir}/1280-${name}-before.png`, fullPage: true });
        await style.evaluate(node => node.remove());
        assert.deepEqual(before, await readFile(`${shotDir}/1280-${name}-after.png`));
      }
    });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
