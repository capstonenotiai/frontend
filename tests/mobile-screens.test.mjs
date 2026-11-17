import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const playwright = await import(process.env.MOBILE_PLAYWRIGHT_MODULE || 'playwright').catch(() => null);

test('모바일 화면: 날짜 선택 목록·상세 시트·공지 탭', {
  skip: !playwright && 'MOBILE_PLAYWRIGHT_MODULE로 기존 Playwright 경로를 지정하세요.', timeout: 120000,
}, async t => {
  const server = await createServer({configFile:false,envDir:false,cacheDir:'node_modules/.vite-mobile-screens-test',server:{host:'127.0.0.1',port:0},define:{'import.meta.env.VITE_USE_MOCK':'"true"'},plugins:[{name:'onboarded',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/data/mockUser.js'))return code.replace('onboarding_done: false','onboarding_done: true, is_admin: true');}},react()]});
  let browser;
  try {
    await server.listen();
    browser = await playwright.chromium.launch({headless:true,executablePath:process.env.MOBILE_CHROMIUM_EXECUTABLE});
    const page = await browser.newPage({viewport:{width:375,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const go = async path => {await page.goto(new URL(path,server.resolvedUrls.local[0]).href);await page.locator('.tb-title').waitFor();await page.waitForTimeout(200);};
    await t.test('홈 요일 키보드 선택→해당 날짜 목록, 더 보기·접기, 7일 이동',async()=>{
      await go('/dashboard');
      assert.equal(await page.locator('.week-date-pick').count(),7);
      const date=page.getByRole('button',{name:'5월 22일 금요일',exact:true});
      await date.focus();await page.keyboard.press('Enter');
      assert.equal(await date.getAttribute('aria-pressed'),'true');
      assert.match(await page.locator('.week-agenda h3').innerText(),/5월 22일/);
      const count=await page.locator('.week-agenda .event-row').count();
      assert.equal(count,3);
      await page.locator('.week-agenda .week-more').click();
      assert.ok(await page.locator('.week-agenda .event-row').count()>count);
      assert.match(await page.locator('.week-agenda').innerText(),/광고대상/);
      await page.locator('.week-agenda .week-more').click();
      assert.equal(await page.locator('.week-agenda .event-row').count(),count);
      await page.getByRole('button',{name:'다음 7일',exact:true}).click();
      assert.match(await page.locator('.week-agenda h3').innerText(),/5월 26일/);
      await page.getByRole('button',{name:'이전 7일',exact:true}).click();
      assert.match(await page.locator('.week-agenda h3').innerText(),/5월 19일/);
      assert.equal(await page.locator('.week-scroll').evaluate(n=>n.scrollWidth<=n.clientWidth),true);
    });
    await t.test('월 날짜 선택→목록, 모달 포커스 이동·순환·Esc 복귀, 월 목록·필터',async()=>{
      await go('/calendar');
      await page.getByRole('button',{name:'5월 22일 금요일',exact:true}).click();
      assert.match(await page.locator('.calendar-agenda h3').innerText(),/5월 22일/);
      assert.match(await page.locator('.calendar-agenda').innerText(),/광고대상/);
      const trigger=page.locator('.calendar-agenda .calendar-event').first();
      await trigger.click();
      const dialog=page.getByRole('dialog');await dialog.waitFor();
      assert.equal(await dialog.getAttribute('aria-modal'),'true');
      const close=dialog.getByRole('button',{name:'닫기',exact:true});
      await close.waitFor();await page.waitForTimeout(100);
      assert.equal(await close.evaluate(n=>n===document.activeElement),true);
      assert.equal(await page.locator('#root').evaluate(n=>n.inert),true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialog.locator('a').last().evaluate(n=>n===document.activeElement),true);
      await page.keyboard.press('Tab');
      assert.equal(await close.evaluate(n=>n===document.activeElement),true);
      const box=await dialog.boundingBox();assert.equal(Math.round(box.y+box.height),900);assert.equal(box.width,375);
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(),0);
      assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
      assert.equal(await page.locator('#root').evaluate(n=>n.inert),false);
      await page.getByRole('button',{name:'이달 목록 보기',exact:true}).click();
      assert.match(await page.locator('.calendar-agenda h3').innerText(),/이달 일정/);
      const total=await page.locator('.calendar-agenda .calendar-event').count();
      await page.getByRole('button',{name:'공모전',exact:true}).click();
      assert.ok(await page.locator('.calendar-agenda .calendar-event').count()<total);
      await page.getByRole('button',{name:'4월 26일 일요일',exact:true}).click();
      assert.match(await page.locator('.calendar-agenda h3').innerText(),/4월 26일/);
    });
    await t.test('공지 세 목록 탭은 경로·현재 선택·개수를 유지한다',async()=>{
      await go('/schedules');
      const tabs=page.getByRole('navigation',{name:'공지 목록',exact:true});
      for(const [label,path] of [['관심 저장','/schedules/saved'],['숨긴 공지','/schedules/hidden'],['전체 공지','/schedules']]){
        await tabs.getByRole('link',{name:new RegExp(label)}).click();
        await page.waitForURL(url=>url.pathname===path);
        await tabs.locator(`[href="${path}"][aria-current="page"]`).waitFor();
        assert.match(await tabs.locator('[aria-current="page"]').innerText(),new RegExp(`${label}[\\s\\S]*\\d+`));
        assert.equal(await tabs.getByRole('link').count(),3);
      }
    });
    await t.test('320px 모든 앱 화면 가로 넘침 0, 768/769 경계에서 구조 전환',async()=>{
      await page.setViewportSize({width:320,height:900});
      for(const path of ['/dashboard','/schedules','/schedules/saved','/schedules/hidden','/planner','/calendar','/settings','/feedback','/admin/review']){
        await go(path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,path);
      }
      await go('/dashboard');await page.setViewportSize({width:768,height:900});await page.locator('.week-date-pick').first().waitFor();
      await page.setViewportSize({width:769,height:900});await page.locator('.week-date-pick').waitFor({state:'detached'});
      assert.equal(await page.locator('.week-weekdays').isVisible(),true);
    });
    assert.deepEqual(errors,[]);
    await page.close();
  } finally {await browser?.close();await server.close();}
});
