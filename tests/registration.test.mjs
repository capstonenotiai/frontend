import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationTargets, needsConfirmation } from '../src/utils/registration.js';

const event = (id, type = 'event', extra = {}) => ({ id, event_type: type, review_status: 'auto',
  schedule_status: 'confirmed', ai_extracted: true, review_required: false, review_reason: null, ...extra });
const request = { id: '1', interview: false };

test('ordinary extracted bundle registers directly, even with unknown schedule status', () => {
  const targets = registrationTargets({ events: [event('1', 'application', { schedule_status: 'unknown' }), event('2')] }, request);
  assert.equal(targets.length, 2);
  assert.equal(needsConfirmation(targets), false);
});

test('a model review or deadline mismatch in any sibling needs confirmation', () => {
  for (const reason of ['모델 원문 확인 요청', '사이트 접수 마감일과 AI 마감일이 다릅니다.']) {
    const targets = registrationTargets({ events: [event('1'), event('2', 'event', { review_required: true, review_reason: reason })] }, request);
    assert.equal(needsConfirmation(targets), true);
  }
});

test('interview warnings do not interrupt ordinary bundle registration', () => {
  const detail = { events: [event('1'), event('2', 'interview', { review_required: true })] };
  assert.deepEqual(registrationTargets(detail, request).map((e) => e.id), ['1']);
  assert.equal(needsConfirmation(registrationTargets(detail, request)), false);
  assert.equal(needsConfirmation(registrationTargets(detail, { id: '2', interview: true })), true);
});

test('clean interview registers separately without confirmation', () => {
  const detail = { events: [event('1'), event('2', 'interview')] };
  const targets = registrationTargets(detail, { id: '2', interview: true });
  assert.deepEqual(targets.map((e) => e.id), ['2']);
  assert.equal(needsConfirmation(targets), false);
});

test('hidden, cancelled and non-public warnings are not registration targets', () => {
  const detail = { events: [event('1'), event('2', 'result', { review_required: true }),
    event('3', 'event', { schedule_status: 'cancelled', review_required: true }),
    event('4', 'event', { review_status: 'rejected', review_required: true })] };
  assert.deepEqual(registrationTargets(detail, request).map((e) => e.id), ['1']);
  assert.equal(needsConfirmation(registrationTargets(detail, request)), false);
});

test('an admin audit reason does not require model confirmation', () => {
  assert.equal(needsConfirmation([event('1', 'event', { ai_extracted: false, review_reason: '관리자 승인' })]), false);
});
