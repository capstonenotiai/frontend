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
