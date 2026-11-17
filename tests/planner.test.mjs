import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANNER_LABELS, SECONDARY_LABELS, plannerLabel, secondaryLabel, countPlannerLabels, plannerSummary, cacheIsFresh, readPlannerCache, writePlannerCache, invalidatePlannerCache, plannerUserInputKey, plannerEventInputKey, trimChatHistory, recommendationTime, plannerErrorMessage } from '../src/utils/planner.js';

test('R03: 입력이 일치할 때만 30분 캐시를 사용하고 모든 모드의 이전 입력을 무효화한다', () => {
  const now = Date.now(); const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  for (const mode of Object.keys(PLANNER_LABELS)) {
    const data = { mode, generated_at: new Date(now).toISOString(), items: [] };
    writePlannerCache(storage, mode, 'a', data, 'old');
    assert.deepEqual(readPlannerCache(storage, mode, 'a', now + 29 * 60000, 'old'), data);
    assert.equal(readPlannerCache(storage, mode, 'a', now + 30 * 60000, 'old'), null);
    assert.equal(readPlannerCache(storage, mode, 'a', now, 'new'), null);
  }
  writePlannerCache(storage, 'focus', 'b', { mode: 'focus', generated_at: new Date(now).toISOString(), items: [] }, 'old');
  invalidatePlannerCache(storage, 'a', 'new'); assert.equal(values.size, 1);
  assert.ok(readPlannerCache(storage, 'focus', 'b', now, 'old'));
  writePlannerCache(storage, 'priority', 'a', { mode: 'priority', generated_at: new Date(now).toISOString(), items: [] });
  assert.equal(readPlannerCache(storage, 'priority', 'a', now, 'new'), null, '입력 정보가 없는 예전 캐시는 재사용하지 않는다');
  assert.doesNotThrow(() => invalidatePlannerCache({ getItem() { throw Error('blocked'); } }, 'a', 'new'));
});
test('R03: 추천 입력 키는 배열 순서·UI 파생값·알림 설정을 무시하고 실제 입력 변경을 구별한다', () => {
  const profile = { major: '수학', grade: 3, enrollment_status: 'enrolled' };
  const prefs = { interests: ['contest', 'career'] };
  const key = plannerUserInputKey(profile, prefs);
  assert.equal(plannerUserInputKey({ ...profile, name: '표시 이름' }, { interests: ['career', 'contest'], notifications: { email: false }, ai_mode: 'focus' }), key);
  for (const patch of [{ major: '물리' }, { grade: 4 }, { enrollment_status: 'leave' }]) assert.notEqual(plannerUserInputKey({ ...profile, ...patch }, prefs), key);
  assert.notEqual(plannerUserInputKey(profile, { ...prefs, enabled_sources: { cbnu: false } }), key);
  const events = [{ id: 'a', registered: false, bookmarked: false, action_status: 'pending', dismissed: false, end_date: '2026-12-20' }, { id: 'b' }];
  const eventKey = plannerEventInputKey(events);
  assert.equal(plannerEventInputKey([...events].reverse().map(e => ({ ...e, dday: 'D-1', sync_status: 'synced' }))), eventKey);
  for (const patch of [{ registered: true }, { bookmarked: true }, { action_status: 'done' }, { dismissed: true }, { end_date: '2026-12-21' }]) assert.notEqual(plannerEventInputKey([{ ...events[0], ...patch }, events[1]]), eventKey);
});

test('플래너: 모든 API 라벨과 후순위 이유를 한국어로 매핑하고 알 수 없는 값은 숨긴다', () => {
  for (const [mode, labels] of Object.entries(PLANNER_LABELS)) for (const [value, label] of Object.entries(labels)) assert.equal(plannerLabel(mode, value), label);
  for (const [value, label] of Object.entries(SECONDARY_LABELS)) assert.equal(secondaryLabel(value), label);
  for (const value of ['unknown', null, undefined, 'toString']) { assert.equal(plannerLabel('priority', value), ''); assert.equal(secondaryLabel(value), ''); }
  assert.equal(plannerLabel('other', 'act'), '');
});
test('플래너: 세 모드 요약·0건·서버 summary가 와도 프론트 문장·0인 라벨 건수', () => {
  const items = [{ title: '장학 신청', next_step_label: 'act' }, { title: '해커톤', next_step_label: 'act' }, { next_step_label: 'prepare' }, { next_step_label: 'unknown' }];
  assert.equal(plannerSummary('priority', { items }), '지금 진행할 일이 2건 있어요. 가장 먼저 할 일은 장학 신청이에요.');
  assert.equal(plannerSummary('priority', { items: [{ title: '공지 확인', next_step_label: 'verify' }] }), '지금 바로 할 일은 없어요. 가장 가까운 일은 공지 확인이에요.');
  assert.equal(plannerSummary('priority', { items: [] }), '지금 바로 할 일은 없어요.');
  assert.deepEqual(countPlannerLabels('priority', items).map(({ count }) => count), [2, 1, 0, 0]);
  assert.equal(plannerSummary('discover', { items: [{ grade: 'strong_match' }, { grade: 'potential_match' }, { grade: 'not_recommended' }] }), '나에게 맞는 새 공지 2건을 골랐어요.');
  assert.equal(plannerSummary('discover'), '나에게 맞는 새 공지 0건을 골랐어요.');
  assert.equal(plannerSummary('focus', { items: [{ tier: 'core' }, { tier: 'secondary' }, { tier: 'secondary' }] }), '1건에 먼저 집중하고, 2건은 미뤄도 괜찮아요.');
  assert.equal(plannerSummary('focus'), '0건에 먼저 집중하고, 0건은 미뤄도 괜찮아요.');
  for (const mode of Object.keys(PLANNER_LABELS)) assert.equal(plannerSummary(mode, { summary: ' 서버 요약 ' }), plannerSummary(mode));
});
test('플래너: 모드·사용자별 저장, 29분 재사용·30분/31분 만료, 손상·접근 거부', () => {
  const now = Date.parse('2026-10-11T12:00:00+09:00');
  const data = { mode: 'priority', generated_at: new Date(now).toISOString(), items: [] };
  const values = new Map(); const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writePlannerCache(storage, 'priority', 'a', data);
  assert.deepEqual(readPlannerCache(storage, 'priority', 'a', now + 29 * 60000), data);
  assert.equal(readPlannerCache(storage, 'priority', 'a', now + 30 * 60000), null);
  assert.equal(readPlannerCache(storage, 'priority', 'a', now + 31 * 60000), null);
  assert.equal(readPlannerCache(storage, 'focus', 'a', now), null);
  assert.equal(readPlannerCache(storage, 'priority', 'b', now), null);
  assert.equal(cacheIsFresh({ mode: 'priority', generated_at: 'bad', data }, 'priority', now), false);
  assert.equal(cacheIsFresh({ mode: 'priority', generated_at: data.generated_at, data }, 'priority', now - 1), false);
  assert.equal(readPlannerCache({ getItem() { return '{invalid'; } }, 'priority', 'a'), null);
  const denied = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
  assert.equal(readPlannerCache(denied, 'priority', 'a'), null);
  assert.doesNotThrow(() => writePlannerCache(denied, 'priority', 'a', data));
});
test('채팅: 이전 대화 중 유효한 최근 12개를 문자열로 변환, 2000자 제한·원본 보존', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: [`메시지 ${i}`, '두 번째 문단'] }));
  const copy = structuredClone(history);
  const trimmed = trimChatHistory([...history, { role: 'system', content: '제외' }, { role: 'user', content: ' ' }]);
  assert.equal(trimmed.length, 12); assert.equal(trimmed[0].content, '메시지 8\n\n두 번째 문단');
  assert.deepEqual(history, copy);
  assert.equal(trimChatHistory([{ role: 'user', content: '가'.repeat(3000) }])[0].content.length, 2000);
});
test('플래너: 한국 시각과 상태별 한국어 오류', () => {
  assert.match(recommendationTime('2026-10-11T06:20:00Z'), /오후 3:20에 받은 추천/);
  assert.equal(recommendationTime('bad'), '');
  assert.equal(plannerErrorMessage({ status: 500 }), 'AI 플래너 설정이 아직 끝나지 않았어요.');
  assert.equal(plannerErrorMessage({ status: 502 }), plannerErrorMessage({ status: 503 }));
  // 사용 제한은 서버 안내 문구를 그대로 보여준다(일반 503 은 기존 문구 유지).
  const daily = '오늘 사용할 수 있는 횟수를 모두 썼어요. 내일 다시 이용해 주세요.';
  assert.equal(plannerErrorMessage({ status: 429, data: { message: daily } }), daily);
  assert.equal(plannerErrorMessage({ status: 503, data: { message: '오늘 AI 사용량이 모두 소진됐어요.' } }), '오늘 AI 사용량이 모두 소진됐어요.');
  assert.equal(plannerErrorMessage({ status: 503, data: { message: 'AI 응답 생성에 실패했습니다.' } }), plannerErrorMessage({ status: 502 }));
  assert.notEqual(plannerErrorMessage({ status: 429 }), '');
});

test('요약 문장 조사: 받침 없으면 예요', async () => {
  const { withCopula } = await import('../src/utils/planner.js');
  assert.equal(withCopula('창업경진대회'), '창업경진대회예요');
  assert.equal(withCopula('장학 신청'), '장학 신청이에요');
  assert.equal(withCopula('2026 SW'), '2026 SW예요');
});

test('플래너: 서버 일정 번호(e123)와 앱 번호를 맞추고 없으면 같은 공지 일정으로 찾는다', async () => {
  const { findPlannerEvent } = await import('../src/utils/planner.js');
  const events = [{ id: '1101', notice_id: 900 }, { id: 'ev1', notice_id: 1 }, { id: '77', notice_id: 45 }];
  assert.equal(findPlannerEvent({ focus_event_id: 'e1101' }, events).id, '1101');
  assert.equal(findPlannerEvent({ focus_event_id: 'ev1' }, events).id, 'ev1');
  assert.equal(findPlannerEvent({ focus_event_id: 'e5', opportunity_id: 'o45' }, events).id, '77');
  assert.equal(findPlannerEvent({ focus_event_id: 'e5', opportunity_id: 'o46' }, events), null);
  assert.equal(findPlannerEvent({}, events), null);
});

test('먼저 할 일 기한: 접수는 마감 시각까지, 행사는 시작 시각 진행, 확인 필요는 표시 안 함', async () => {
  const { actionDeadline } = await import('../src/utils/planner.js');
  const item = { action_date: '2026-11-19', start_date: '2026-11-17', end_date: '2026-11-19', start_time: '', end_time: '16:00', next_step_label: 'act' };
  assert.equal(actionDeadline(item, { event_type: 'application' }), '11/19(목) 16:00까지');
  assert.equal(actionDeadline({ ...item, end_time: '' }), '11/19(목)까지');
  assert.equal(actionDeadline({ ...item, action_date: '2026-11-18', start_date: '2026-11-18', start_time: '10:00' }, { event_type: 'event' }), '11/18(수) 10:00 진행');
  assert.equal(actionDeadline({ ...item, next_step_label: 'verify' }), '');
  assert.equal(actionDeadline({}), '');
});

test('집중할 것 비교 묶음: 핵심과 이긴·겹친 후순위를 묶고 나머지는 rest', async () => {
  const { buildFocusGroups, scheduleLabel, eligibilityLabel } = await import('../src/utils/planner.js');
  const items = [
    { opportunity_id: 'o1', tier: 'core', chosen_over: [], conflicts_with: ['o2'] },
    { opportunity_id: 'o2', tier: 'secondary', chosen_over: [], conflicts_with: ['o1'] },
    { opportunity_id: 'o3', tier: 'core', chosen_over: ['o4', 'o5', 'o9'], conflicts_with: [] },
    { opportunity_id: 'o4', tier: 'secondary' }, { opportunity_id: 'o5', tier: 'secondary' },
    { opportunity_id: 'o6', tier: 'core', chosen_over: [], conflicts_with: [] },
    { opportunity_id: 'o7', tier: 'secondary', conflicts_with: ['o8'] }, { opportunity_id: 'o8', tier: 'core', chosen_over: ['o2'] },
  ];
  const { groups, rest } = buildFocusGroups(items);
  assert.deepEqual(groups.map((g) => [g.kind, g.chosen.opportunity_id, g.others.map((o) => o.opportunity_id)]),
    [['time', 'o1', ['o2']], ['similar', 'o3', ['o4', 'o5']], ['time', 'o8', ['o7']]]);
  assert.deepEqual(rest.map((item) => item.opportunity_id), ['o6']);
  assert.deepEqual(buildFocusGroups([]), { groups: [], rest: [] });
  assert.equal(scheduleLabel({ start_date: '2026-11-18', end_date: '2026-11-18', start_time: '10:00', end_time: '17:00' }), '11/18(수) 10:00~17:00');
  assert.equal(scheduleLabel({ start_date: '2026-11-25', end_date: '2026-11-29' }), '11/25(수)~11/29(일)');
  assert.equal(scheduleLabel({}), '날짜 미정');
  assert.equal(eligibilityLabel('needs_check'), '확인 필요'); assert.equal(eligibilityLabel(undefined), '정보 없음');
});

test('겹치는 일정 시각은 서울 기준, 종일은 날짜만, 말머리 제거', async () => {
  const { slotLabel, plainTitle } = await import('../src/utils/planner.js');
  assert.equal(slotLabel(['2026-11-18T14:00:00+09:00', '2026-11-18T16:00:00+09:00']), '11/18(수) 14:00~16:00');
  assert.equal(slotLabel(['2026-11-18T05:00:00+00:00', '2026-11-18T07:00:00+00:00']), '11/18(수) 14:00~16:00');
  assert.equal(slotLabel(['2026-11-18T00:00:00+09:00', '2026-11-19T00:00:00+09:00']), '11/18(수)');
  assert.equal(slotLabel(null), ''); assert.equal(slotLabel(['bad', 'bad']), '');
  assert.equal(plainTitle('[외국인 취준생 필독] 2026 서울 박람회'), '2026 서울 박람회'); assert.equal(plainTitle('[공지]'), '[공지]');
});

test('집중할 것: 서버 묶음이 있으면 그대로 쓰고 핵심을 첫 열로', async () => {
  const { buildFocusGroups } = await import('../src/utils/planner.js');
  const items = [{ opportunity_id: 'o1', tier: 'secondary' }, { opportunity_id: 'o2', tier: 'core' }, { opportunity_id: 'o3', tier: 'secondary' }, { opportunity_id: 'o4', tier: 'core' }];
  const { groups, rest } = buildFocusGroups(items, [{ group_id: 'g1', kind: 'time', members: ['o1', 'o2'] }, { group_id: 'g2', kind: 'similar', members: ['o3', 'o9'] }]);
  assert.deepEqual(groups.map((g) => [g.kind, g.chosen.opportunity_id, g.others.map((o) => o.opportunity_id)]), [['time', 'o2', ['o1']]]);
  assert.deepEqual(rest.map((i) => i.opportunity_id), ['o3', 'o4']);
});
