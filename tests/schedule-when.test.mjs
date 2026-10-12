import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScheduleWhen } from '../src/utils/scheduleWhen.js';

test('타임라인 날짜는 요일·기간·시각을 표시하고 같은 시작과 끝을 반복하지 않는다', () => {
  assert.equal(formatScheduleWhen({ start_date: '2026-05-22', end_date: '2026-05-22' }), '5.22(금)');
  assert.equal(formatScheduleWhen({ start_date: '2026-05-01', end_date: '2026-05-22' }), '5.1(금) ~ 5.22(금)');
  assert.equal(formatScheduleWhen({ end_date: '2026-05-22', start_time: '14:00' }), '5.22(금) 14:00');
  assert.equal(formatScheduleWhen({ start_date: '2026-05-22', end_date: '2026-05-22', start_time: '14:00', end_time: '14:00' }), '5.22(금) 14:00');
  assert.equal(formatScheduleWhen({ start_date: '2026-05-22', start_time: '14:00', end_time: '16:00' }), '5.22(금) 14:00 ~ 16:00');
  assert.equal(formatScheduleWhen({ start_date: '2026-05-01', end_date: '2026-05-22', start_time: '09:00', end_time: '18:00' }), '5.1(금) 09:00 ~ 5.22(금) 18:00');
  assert.equal(formatScheduleWhen({}), '날짜 미확인');
  assert.equal(formatScheduleWhen({ start_date: '2026-02-30' }), '날짜 미확인');
});
