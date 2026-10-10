import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeek, layoutWeek, weekProgress } from '../src/utils/weekCalendar.js';
import { mockEvents } from '../src/data/mockEvents.js';

const week = buildWeek('2026-05-19', 0);
const event = (id, start_date, end_date, extra = {}) => ({ id, start_date, end_date, registered: true, ...extra });

test('오늘이 첫 칸이며 7일씩 이동하고 연말을 넘는다', () => {
  assert.deepEqual(week, ['2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25']);
  assert.equal(buildWeek('2026-05-19', 1)[0], '2026-05-26');
  assert.equal(buildWeek('2026-05-19', 2)[0], '2026-06-02');
  assert.equal(buildWeek(new Date(2026, 11, 29), 0).at(-1), '2027-01-04');
});

test('하루 일정은 마감 칸에 넣고 미등록·숨김·주 밖의 하루 일정은 제외한다', () => {
  const input = [event('one', '2026-05-20', '2026-05-20'), event('no-start', '', '2026-05-22'),
    event('start-only', '2026-05-23', ''), event('outside', '', '2026-05-26'),
    event('unregistered', '', '2026-05-21', { registered: false }), event('hidden', '', '2026-05-21', { dismissed: true })];
  const snapshot = structuredClone(input);
  const result = layoutWeek(input, week);
  assert.deepEqual(result.chips['2026-05-20'], ['one']);
  assert.deepEqual(result.chips['2026-05-22'], ['no-start']);
  assert.deepEqual(result.chips['2026-05-23'], ['start-only']);
  assert.equal(Object.values(result.chips).flat().length, 3);
  assert.deepEqual(result.bars, []);
  assert.deepEqual(input, snapshot);
});

test('겹치는 막대는 다른 줄을 쓰며 빈 줄을 재사용한다', () => {
  const result = layoutWeek([event('a', '2026-05-19', '2026-05-21'), event('b', '2026-05-20', '2026-05-22'), event('c', '2026-05-22', '2026-05-24')], week);
  assert.deepEqual(result.bars.map(({ id, colStart, colEnd, lane }) => ({ id, colStart, colEnd, lane })), [
    { id: 'a', colStart: 1, colEnd: 3, lane: 0 }, { id: 'b', colStart: 2, colEnd: 4, lane: 1 }, { id: 'c', colStart: 4, colEnd: 6, lane: 0 },
  ]);
});

test('주 경계에서 막대를 자르고 양쪽 열림을 표시하며 겹치지 않는 기간은 제외한다', () => {
  const result = layoutWeek([event('left', '2026-05-01', '2026-05-22'), event('right', '2026-05-24', '2026-05-30'),
    event('both', '2026-05-01', '2026-05-30'), event('past', '2026-05-01', '2026-05-18'), event('future', '2026-05-26', '2026-05-30')], week);
  assert.equal(result.bars.length, 3);
  assert.deepEqual(result.bars.find((bar) => bar.id === 'left'), { id: 'left', colStart: 1, colEnd: 4, lane: 0, openLeft: true, openRight: false });
  assert.deepEqual(result.bars.find((bar) => bar.id === 'both'), { id: 'both', colStart: 1, colEnd: 7, lane: 1, openLeft: true, openRight: true });
  assert.deepEqual(result.bars.find((bar) => bar.id === 'right'), { id: 'right', colStart: 6, colEnd: 7, lane: 0, openLeft: false, openRight: true });
});

test('완료 수는 이번 주에 마감되는 등록 일정만 센다', () => {
  const input = [event('a', '', '2026-05-19', { action_status: 'done' }), event('b', '2026-05-25', ''),
    event('c', '2026-05-20', '2026-05-26', { action_status: 'done' }),
    event('d', '', '2026-05-22', { action_status: 'done', registered: false }), event('e', '', '2026-05-22', { dismissed: true })];
  assert.deepEqual(weekProgress(input, week), { done: 1, total: 2 });
  assert.deepEqual(weekProgress([], week), { done: 0, total: 0 });
});

test('mock 홈은 겹친 기간·주 밖 연결·완료·하루 4건·확인 필요·남은 새 공지를 제공한다', () => {
  const result = layoutWeek(mockEvents, week);
  assert.equal(result.bars.length, 2);
  assert.deepEqual(result.bars.map((bar) => bar.lane), [0, 1]);
  assert.ok(result.bars.some((bar) => bar.openRight));
  assert.equal(result.chips['2026-05-22'].length, 4);
  assert.deepEqual(weekProgress(mockEvents, week), { done: 1, total: 5 });
  assert.ok(mockEvents.some((event) => event.review_required));
  assert.equal(mockEvents.filter((event) => event.is_new && !event.dismissed).length, 5);
});
