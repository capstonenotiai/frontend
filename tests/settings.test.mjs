import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWelcome, welcomeKey, completeWelcome, buildProfileBody, buildPreferencesBody, canToggleSource, buildReportBody, buildFeedbackBody, createSaveQueue } from '../src/utils/settings.js';

const profile = { email: 'fixture@example.test', major: '', grade: null, enrollment_status: 'unknown' };
test('첫 로그인: 빈 프로필·관심 없음·기록 없음만 안내하며 저장 접근 제한을 견딘다', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(shouldShowWelcome(profile, { interests: [] }, storage), true);
  for (const patch of [{ major: '학부' }, { grade: 1 }, { enrollment_status: 'enrolled' }]) assert.equal(shouldShowWelcome({ ...profile, ...patch }, { interests: [] }, storage), false);
  assert.equal(shouldShowWelcome(profile, { interests: ['contest'] }, storage), false);
  assert.equal(shouldShowWelcome({ ...profile, email: '' }, { interests: [] }, storage), false);
  completeWelcome(profile.email, storage);
  assert.equal(values.get(welcomeKey(profile.email)), '1');
  assert.equal(shouldShowWelcome(profile, { interests: [] }, storage), false);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(shouldShowWelcome(profile, { interests: [] }, blocked), true);
  assert.doesNotThrow(() => completeWelcome(profile.email, blocked));
});
test('프로필: 전체 본문·학년 1~6/null·전공 255자·재학 상태 enum 검증', () => {
  for (const grade of [null, 1, 2, 3, 4, 5, 6]) assert.equal(buildProfileBody({ ...profile, grade }).grade, grade);
  for (const grade of [0, 7, 1.5, '3', true, NaN]) assert.throws(() => buildProfileBody({ ...profile, grade }));
  assert.equal(buildProfileBody({ ...profile, major: '가'.repeat(255) }).major.length, 255);
  assert.throws(() => buildProfileBody({ ...profile, major: '가'.repeat(256) }));
  assert.throws(() => buildProfileBody({ ...profile, major: 123 }));
  for (const enrollment_status of ['enrolled', 'expected_graduation', 'leave', 'graduated', 'unknown']) assert.equal(buildProfileBody({ ...profile, enrollment_status }).enrollment_status, enrollment_status);
  assert.throws(() => buildProfileBody({ ...profile, enrollment_status: 'invalid' }));
  assert.deepEqual(Object.keys(buildProfileBody(profile)), ['major', 'grade', 'enrollment_status']);
});
test('출처: 마지막 켜진 하나는 끌 수 없고 다른 출처를 켤 수 있다', () => {
  const sources = { cbnu: true, wevity: false, contestkorea: false };
  assert.equal(canToggleSource(sources, 'cbnu', false), false);
  assert.equal(canToggleSource(sources, 'wevity', true), true);
  assert.equal(canToggleSource({ ...sources, wevity: true }, 'cbnu', false), true);
  assert.equal(canToggleSource(sources, 'unknown', true), false);
  assert.equal(canToggleSource({}, 'cbnu', false), true);
});
test('preferences: 두 AI 필드와 예전 알림은 제외하고 현재 알림 전체를 보낸다', () => {
  const input = { ai_mode: 'focus', auto_mode_recommend: false, interests: [], enabled_sources: { cbnu: false }, notifications: { d3: false, d7: true, new_event: true } };
  const body = buildPreferencesBody(input);
  assert.deepEqual(body, { interests: [], enabled_sources: { cbnu: false, wevity: true, contestkorea: true }, notifications: { d3: false, d1: true, email: true } });
  assert.equal(Object.hasOwn(body, 'ai_mode'), false); assert.equal(Object.hasOwn(body, 'auto_mode_recommend'), false);
  body.interests.push('academic'); assert.equal(input.interests.length, 0);
});
test('신고·의견: enum 검증·2000자 초과 거부·답변 이메일 선택', () => {
  for (const reason of ['date', 'time', 'location', 'nonexistent', 'other']) assert.deepEqual(buildReportBody(reason, '메모'), { reason, memo: '메모' });
  assert.equal(buildReportBody('other', '가'.repeat(2000)).memo.length, 2000);
  assert.throws(() => buildReportBody('bad')); assert.throws(() => buildReportBody('date', '가'.repeat(2001)));
  for (const type of ['inconvenience', 'suggestion', 'praise', 'other']) assert.deepEqual(buildFeedbackBody({ type, message: ' 의견 ' }), { type, message: '의견' });
  assert.deepEqual(buildFeedbackBody({ type: 'other', message: '내용', replyEmail: 'fixture@example.test' }), { type: 'other', message: '내용', reply_email: 'fixture@example.test' });
  assert.throws(() => buildFeedbackBody({ type: 'bad', message: '의견' }));
  assert.throws(() => buildFeedbackBody({ type: 'other', message: '   ' }));
  assert.throws(() => buildFeedbackBody({ type: 'other', message: '가'.repeat(2001) }));
});
test('저장 큐: 느린 첫 요청 뒤 변경 순서·마지막 값 유지, 실패 뒤 재시도', async () => {
  const queue = createSaveQueue(); const order = []; let release; let stored;
  const gate = new Promise(resolve => { release = resolve; });
  const first = queue(async () => { order.push('first-start'); await gate; stored = 1; order.push('first-end'); });
  const second = queue(async () => { order.push('second'); stored = 2; });
  const third = queue(async () => { order.push('third'); stored = 3; });
  await Promise.resolve(); assert.deepEqual(order, ['first-start']);
  release(); await Promise.all([first, second, third]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second', 'third']); assert.equal(stored, 3);
  await assert.rejects(queue(async () => { throw Error('failed'); }));
  await queue(async () => { stored = 4; }); assert.equal(stored, 4);
});

test('관심분야 최소 1개: 마지막 하나는 끌 수 없고 0개면 다음으로 못 감', async () => {
  const { canToggleInterest, hasInterest } = await import('../src/utils/settings.js');
  assert.equal(canToggleInterest(['academic'], 'academic'), false);
  assert.equal(canToggleInterest(['academic', 'contest'], 'academic'), true);
  assert.equal(canToggleInterest([], 'academic'), true);
  assert.equal(canToggleInterest(['academic'], 'contest'), true);
  assert.equal(hasInterest([]), false);
  assert.equal(hasInterest(['career']), true);
});
