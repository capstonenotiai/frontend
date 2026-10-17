import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir } from 'node:fs/promises';
import { APP_PAGES, MOBILE_TABS, getMorePages } from '../src/config/navigation.js';
const playwright = await import(process.env.MOBILE_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('모바일 메뉴는 navigation 정의를 공유하고 관리자 항목을 권한에 따라 제한한다', () => {
  assert.deepEqual(MOBILE_TABS.map(p => p.id), ['dashboard', 'schedules', 'planner', 'calendar']);
  for (const admin of [false, true]) {
    const pages = [...MOBILE_TABS, ...getMorePages(admin)];
    assert.deepEqual(new Set(pages), new Set(APP_PAGES.filter(p => !p.adminOnly || admin)));
    assert.equal(getMorePages(admin).some(p => p.adminOnly), admin);
  }
});

test('모바일 공통 틀: 현재 경로·시트·포커스·전체 화면·PC 회귀', {
  skip: !playwright && 'MOBILE_PLAYWRIGHT_MODULE로 기존 Playwright 경로를 지정하세요.', timeout: 120000,
}, async t => {
  const shots = process.env.MOBILE_SHELL_SHOTS;
  const server = await createServer({ configFile: false, envDir: false,
    cacheDir: 'node_modules/.vite-mobile-shell-test', server: { port: 0, host: '127.0.0.1' },
    define: { 'import.meta.env.VITE_USE_MOCK': JSON.stringify('true') },
    plugins: [{ name: 'mobile-onboarded-fixture', enforce: 'pre', transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/data/mockUser.js')) return code.replace('onboarding_done: false', 'onboarding_done: true, is_admin: true');
    } }, react()],
  });
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.MOBILE_CHROMIUM_EXECUTABLE });
    if (shots) await mkdir(shots, { recursive: true });
    for (const width of [320, 375, 768, 1280]) await t.test(`${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const go = async path => {
        await page.goto(new URL(path, server.resolvedUrls.local[0]).href);
        await page.locator('.tb-title').waitFor();
        await page.waitForTimeout(800);
        await page.evaluate(() => document.fonts.ready);
      };
      const capture = async name => { if (shots) { await page.waitForTimeout(200); await page.screenshot({ path: `${shots}/${width}-${name}.png` }); } };
      await go('/dashboard');
      await capture('home');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (width === 320) {
        await page.locator('.tb-title').evaluate(n=> {n.textContent='아주 긴 이름과 제목이 들어오는 모바일 상단바 확인';});
        assert.equal(await page.locator('.tb-title').evaluate(n=>n.scrollWidth>n.clientWidth && getComputedStyle(n).textOverflow==='ellipsis'),true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
      }
      await go('/schedules'); await capture('notices');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const tabs = page.getByRole('navigation', { name: '주 메뉴', exact: true });
      if (width <= 768) {
        assert.equal(await page.locator('.sidebar').isVisible(), false);
        assert.equal(await tabs.locator('[aria-current="page"]').innerText(), '공지');
        for (const [path, label] of [['/dashboard','홈'], ['/planner','AI 플래너'], ['/calendar','캘린더'], ['/schedules/saved','공지'], ['/schedules/hidden','공지']]) {
          await go(path); assert.equal(await tabs.locator('[aria-current="page"]').innerText(), label);
        }
        const more = tabs.getByRole('button', { name: '더보기' });
        await more.click();
        const dialog = page.getByRole('dialog', { name: 'NotiAI' });
        await dialog.waitFor();
        assert.deepEqual(await dialog.getByRole('link').evaluateAll(nodes => nodes.map(n => ({path:n.getAttribute('href'),label:n.textContent.replace(/\d+$/, '')}))), getMorePages(true).map(p => ({path:p.path,label:p.label})));
        assert.equal(await dialog.locator('.sb-badge').first().innerText(), await page.locator('.sidebar .sb-badge').first().innerText());
        assert.equal(await dialog.getByRole('link').first().evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Shift+Tab');
        assert.equal(await dialog.getByRole('button', { name: '메뉴 닫기' }).evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Tab');
        await capture('more');
        await page.keyboard.press('Escape');
        assert.equal(await more.evaluate(n => n === document.activeElement), true);
        await more.click(); await page.locator('.mobile-more-backdrop').click({ position: { x: 2, y: 2 } });
        assert.equal(await more.evaluate(n => n === document.activeElement), true);
        await more.click(); await dialog.getByRole('link', { name: '설정', exact: true }).click();
        assert.equal(await dialog.count(), 0);
        assert.equal(await more.evaluate(n => n === document.activeElement), true);
        await page.setViewportSize({ width:1280,height:900 }); await tabs.waitFor({state:'detached'});
        await page.setViewportSize({ width,height:900 });
      } else {
        assert.equal(await tabs.count(), 0); assert.equal(await page.locator('.sidebar').isVisible(), true);
        await capture('more');
      }
      await page.getByRole('button', {name:/^알림( \d+개)?$/}).click();
      await page.locator('.notification-row').first().waitFor(); await capture('notifications');
      if (width <= 768) {
        const box = await page.getByRole('dialog', {name:'알림함'}).boundingBox();
        assert.equal(box.width,width); assert.equal(box.height,900);
        await page.getByRole('button', {name:'알림 닫기'}).click();
        assert.equal(await page.locator('.notification-bell').evaluate(n=>n===document.activeElement),true);
      } else await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'채팅 열기'}).click(); await capture('chat');
      if (width <= 768) {
        const box = await page.getByRole('dialog',{name:'내 일정에 대해 묻기'}).boundingBox();
        assert.equal(box.width,width); assert.equal(box.height,900);
        await page.setViewportSize({width,height:480});
        const input = await page.getByRole('textbox',{name:'채팅 메시지'}).boundingBox();
        assert.ok(input.y+input.height<=480);
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button',{name:'채팅 열기'}).evaluate(n=>n===document.activeElement),true);
      if (width === 320) {
        await page.setViewportSize({width,height:900});
        for (const path of ['/dashboard','/schedules','/schedules/saved','/schedules/hidden','/planner','/calendar','/settings','/feedback','/admin/review']) {
          await go(path);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,path);
        }
        await go('/settings');
        await page.getByRole('button',{name:'계정 삭제',exact:true}).click();
        const deletion = page.getByRole('dialog',{name:'계정을 삭제할까요?'});
        const deleteBox = await deletion.boundingBox();
        assert.ok(deleteBox.x >= 0 && deleteBox.x + deleteBox.width <= width);
        const buttons = await deletion.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
        assert.equal(buttons[0],buttons[1]);
        await capture('delete-dialog'); await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('button',{name:'계정 삭제',exact:true}).evaluate(n=>n===document.activeElement),true);
        await go('/schedules');
        const reviewed = page.locator('.event-item').filter({has:page.locator('.event-row .event-review')}).first();
        await reviewed.locator('.event-row').click();
        await reviewed.getByRole('button',{name:'등록 해제',exact:true}).click();
        const toast = await page.locator('.undo-toast').boundingBox();
        const tabBox = await tabs.boundingBox();
        assert.ok(toast && toast.y+toast.height<tabBox.y);
        await reviewed.getByRole('button',{name:'일정 등록',exact:true}).click();
        const confirm = page.getByRole('dialog');
        await confirm.getByRole('checkbox').waitFor();
        const confirmBox = await confirm.boundingBox();
        assert.ok(confirmBox.x >= 0 && confirmBox.x+confirmBox.width <= width);
        assert.equal(await confirm.evaluate(n=>n.scrollWidth<=n.clientWidth),true);
        await capture('register-dialog'); await page.keyboard.press('Escape');
        assert.equal(await reviewed.getByRole('button',{name:'일정 등록',exact:true}).evaluate(n=>n===document.activeElement),true);
      }
      assert.deepEqual(errors,[]);
      await page.close();
    });
  } finally { await browser?.close(); await server.close(); }
});
