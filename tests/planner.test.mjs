import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANNER_LABELS, SECONDARY_LABELS, plannerLabel, secondaryLabel, countPlannerLabels, plannerSummary, cacheIsFresh, readPlannerCache, writePlannerCache, trimChatHistory, recommendationTime, plannerErrorMessage } from '../src/utils/planner.js';

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
});

test('요약 문장 조사: 받침 없으면 예요', async () => {
  const { withCopula } = await import('../src/utils/planner.js');
  assert.equal(withCopula('창업경진대회'), '창업경진대회예요');
  assert.equal(withCopula('장학 신청'), '장학 신청이에요');
  assert.equal(withCopula('2026 SW'), '2026 SW예요');
});
