import test from 'node:test';
import assert from 'node:assert/strict';
import { countSaved, countHidden, formatKoreanToday } from '../src/utils/foundation.js';
import { getAppPageByPath } from '../src/config/navigation.js';

test('저장·등록·숨김의 모든 조합에서 배지 개수를 계산한다', () => {
  const events = [];
  for (const bookmarked of [false, true]) {
    for (const registered of [false, true]) {
      for (const dismissed of [false, true]) {
        const event = { bookmarked, registered, dismissed };
        assert.equal(countSaved([event]), bookmarked && !registered && !dismissed ? 1 : 0);
        assert.equal(countHidden([event]), dismissed ? 1 : 0);
        events.push(event);
      }
    }
  }
  const snapshot = structuredClone(events);
  assert.equal(countSaved(events), 1);
  assert.equal(countHidden(events), 4);
  assert.deepEqual(events, snapshot);
  assert.equal(countSaved([]), 0);
  assert.equal(countHidden([]), 0);
  assert.equal(countSaved([{ bookmarked: true }]), 1);
  assert.equal(countHidden([{}]), 0);
});

test('한국어 오늘 날짜는 전달된 로컬 날짜와 요일을 사용한다', () => {
  assert.equal(formatKoreanToday(new Date(2026, 9, 11)), '10월 11일 일요일');
  assert.equal(formatKoreanToday(new Date(2026, 9, 12)), '10월 12일 월요일');
});

test('하위 일정 경로는 가장 긴 경로로 판별한다', () => {
  assert.equal(getAppPageByPath('/schedules/saved').label, '관심 저장');
  assert.equal(getAppPageByPath('/schedules/hidden').label, '숨긴 공지');
  assert.equal(getAppPageByPath('/schedules').label, '전체 공지');
  assert.equal(getAppPageByPath('/schedules/saved/detail').id, 'saved');
  assert.equal(getAppPageByPath('/schedules-extra'), undefined);
  assert.equal(getAppPageByPath('/curation'), undefined);
});
