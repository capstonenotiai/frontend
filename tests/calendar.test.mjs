import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthGrid, filterByCategories, layoutMonthWeek } from '../src/utils/monthCalendar.js';
import { layoutWeek } from '../src/utils/weekCalendar.js';

const event = (id, start_date, end_date, extra = {}) => ({ id, title: id, start_date, end_date, registered: true, category: 'academic', ...extra });

test('월 격자는 일요일부터 토요일까지 4·5·6주를 만들고 연말을 넘는다', () => {
  const october = buildMonthGrid(2026, 9);
  assert.equal(october.length, 5);
  assert.equal(october[0][0], '2026-09-27');
  assert.equal(october.at(-1).at(-1), '2026-10-31');
  const february = buildMonthGrid(2026, 1);
  assert.equal(february.length, 4);
  assert.equal(february[0][0], '2026-02-01');
  assert.equal(february.at(-1).at(-1), '2026-02-28');
  assert.equal(buildMonthGrid(2026, 4).length, 6);
  assert.equal(buildMonthGrid(2026, 11).at(-1).at(-1), '2027-01-02');
  for (const weeks of [october, february, buildMonthGrid(2026, 4)]) {
    assert.ok(weeks.every((week) => week.length === 7));
    const dates = weeks.flat();
    dates.forEach((date, index) => { if (index) assert.equal(Date.parse(date) - Date.parse(dates[index - 1]), 86400000); });
  }
});

test('분야 필터는 여러 분야를 끄고 켜며 입력을 변경하지 않는다', () => {
  const input = [event('a', '', '2026-10-12'), event('b', '', '2026-10-12', { category: 'career' }), event('c', '', '2026-10-12', { category: 'contest' })];
  const snapshot = structuredClone(input);
  assert.deepEqual(filterByCategories(input, ['career', 'contest']).map((e) => e.id), ['a']);
  assert.deepEqual(filterByCategories(input, new Set(['academic'])).map((e) => e.id), ['b', 'c']);
  assert.deepEqual(filterByCategories(input, new Set()), input);
  assert.deepEqual(input, snapshot);
});

test('달을 넘는 기간 막대는 layoutWeek를 재사용해 주마다 양 끝 연결을 유지한다', () => {
  const input = [event('span', '2026-09-25', '2026-10-06')];
  const weeks = buildMonthGrid(2026, 9);
  const first = layoutWeek(input, weeks[0]).bars[0];
  const second = layoutWeek(input, weeks[1]).bars[0];
  assert.deepEqual(first, { id: 'span', colStart: 1, colEnd: 7, lane: 0, openLeft: true, openRight: true });
  assert.deepEqual(second, { id: 'span', colStart: 1, colEnd: 3, lane: 0, openLeft: true, openRight: false });
  assert.deepEqual(layoutMonthWeek(input, weeks[0]).bars, [first]);
  assert.deepEqual(layoutMonthWeek(input, weeks[1]).bars, [second]);
  assert.equal(layoutMonthWeek(input, weeks[2]).bars.length, 0);
});

test('하루 3줄 제한은 기간 lane과 칩을 합산하고 숨긴 막대도 더 보기 목록에 포함한다', () => {
  const week = buildMonthGrid(2026, 9)[2];
  const input = [event('bar1', week[0], week[3]), event('bar2', week[1], week[3]),
    event('bar3', week[2], week[3]), event('bar4', week[2], week[4]),
    event('chip1', '', week[2]), event('chip2', '', week[2]), event('solo', '', week[6])];
  const result = layoutMonthWeek(input, week);
  assert.equal(result.bars.length, 3);
  assert.equal(result.days[2].chips.length, 0);
  assert.equal(result.days[2].more, 3);
  assert.deepEqual(new Set(result.days[2].ids), new Set(['bar1', 'bar2', 'bar3', 'bar4', 'chip1', 'chip2']));
  assert.deepEqual(result.days[6].chips, [{ id: 'solo', lane: 0 }]);
  for (const [col, day] of result.days.entries()) {
    const visibleBars = result.bars.filter((bar) => bar.colStart <= col + 1 && bar.colEnd >= col + 1);
    assert.ok(visibleBars.length + day.chips.length <= 3);
    assert.equal(day.ids.length, visibleBars.length + day.chips.length + day.more);
  }
});

test('면접은 하루 일정이고 완료 일정은 남으며 미등록·숨김은 제외한다', () => {
  const week = buildMonthGrid(2026, 9)[2];
  const input = [event('interview', week[1], week[3], { event_type: 'interview' }),
    event('done', '', week[3], { action_status: 'done' }), event('saved', '', week[3], { registered: false, bookmarked: true }),
    event('hidden', '', week[3], { dismissed: true })];
  const snapshot = structuredClone(input);
  const result = layoutMonthWeek(input, week);
  assert.equal(result.bars.length, 0);
  assert.deepEqual(result.days[3].ids, ['interview', 'done']);
  assert.deepEqual(input, snapshot);
});
