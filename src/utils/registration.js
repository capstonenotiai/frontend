/** Use the whole notice bundle; interviews require their own opt-in action. */
export function registrationTargets(detail, request) {
  return detail.events.filter((event) =>
    (request.interview ? event.id === request.id : event.event_type !== 'interview')
    && !['result', 'service_change', 'award', 'survey'].includes(event.event_type)
    && event.schedule_status !== 'cancelled' && ['auto', 'approved'].includes(event.review_status));
}

export function needsConfirmation(events) {
  return events.some((event) => event.review_required || Boolean(event.ai_extracted && event.review_reason));
}

/** 확인 필요 이유 → 등록 창에서 강조할 칸. 실제 이유 문구(backend review.py·추출 후처리) 기준. */
export function flaggedFields(reason = '') {
  const fields = new Set();
  if (!reason) return fields;
  if (/날짜·장소/.test(reason)) ['start_date', 'end_date', 'location'].forEach((key) => fields.add(key));
  if (/마감/.test(reason)) fields.add('end_date');
  if (/접수 기간|게시일보다|날짜를 확인/.test(reason)) { fields.add('start_date'); fields.add('end_date'); }
  return fields;
}

/** 확인이 필요한 일정의 이유(확인 대상이 아니면 빈 문자열). */
export function confirmationReason(event) {
  return event?.review_required || event?.ai_extracted ? (event.review_reason || '') : '';
}
