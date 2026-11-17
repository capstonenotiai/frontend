import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse, ApiError } from './apiClient';

const notices = Array.from({ length: 34 }, (_, i) => ({ id: i + 1, title: i === 1 ? '대학생 공모전 접수 일정 확인 요청' : `2026 충북대학교 창업경진대회 참가자 모집 ${i + 1}`, state: i === 1 ? 'approved' : i === 2 ? 'processing' : 'needs_review', revision: 1, source: i === 1 ? 'contestkorea' : 'cbnu', published_at: '2026-10-18', crawled_at: '2026-10-18T00:00:00Z', reason: '마감 시각을 원문에서 확인해 주세요.', open_report_count: i === 1 ? 1 : 0, body: '접수: 2026.11.02 ~ 11월 20일 18시까지\n장소: 개신문화관\n발표: 12/01', source_url: 'https://example.com/notice', model_output: null, history: [], events: [{ id: i + 1, title: '창업경진대회 참가 접수', start_date: '2026-11-02', end_date: '2026-11-20', start_time: '09:00', end_time: '18:00', timezone: 'Asia/Seoul', location: '개신문화관', detail: '참가 신청서를 제출해 주세요.', event_type: 'application', attendance_mode: 'offline', schedule_status: 'confirmed', review_status: 'auto', review_reason: '마감 시각을 확인해 주세요.' }], reports: i === 1 ? [{ id: 1, reason: 'date', memo: '원문에는 마감일이 11월 21일로 나와 있어요.', created_at: '2026-10-18T00:00:00Z', resolved_at: null }] : [] }));
const feedback = Array.from({ length: 54 }, (_, i) => ({ id: 54 - i, type: ['suggestion', 'inconvenience', 'praise', 'other'][i % 4], message: i ? `서비스 의견 ${i}` : '일정 검수가 편리해졌어요.\n마감 시각도 함께 확인하고 싶어요.', reply_email: i % 3 ? null : 'student@example.com', created_at: '2026-10-18T09:00:00+09:00' }));
const matches = (n, state) => state === 'all' || (state === 'reported' ? n.open_report_count > 0 : n.state === state);
export function getCounts(signal) {
  if (USE_MOCK) return mockResponse(Object.fromEntries(['needs_review', 'reported', 'failed', 'pending', 'retry_pending', 'processing', 'approved', 'rejected', 'extracted', 'no_events', 'all'].map(s => [s, notices.filter(n => matches(n, s)).length])));
  return apiRequest('/api/admin/notices/counts', { signal });
}
export function getQueue(state, offset, signal) {
  if (USE_MOCK) { const items = notices.filter(n => matches(n, state)); return mockResponse({ total: items.length, items: items.slice(offset, offset + 30).map(({ events, reports, history, body, model_output, ...n }) => n) }); }
  return apiRequest(`/api/admin/notices?state=${encodeURIComponent(state)}&offset=${offset}`, { signal });
}
export function getNotice(id, signal) {
  if (USE_MOCK) { const n = notices.find(n => n.id === Number(id)); return n ? mockResponse(n) : Promise.reject(new ApiError('공지를 찾을 수 없습니다.', { status: 404 })); }
  return apiRequest(`/api/admin/notices/${id}`, { signal });
}
export function reviewNotice(id, body) {
  if (USE_MOCK) {
    const n = notices.find(n => n.id === Number(id));
    if (!n) return Promise.reject(new ApiError('공지를 찾을 수 없습니다.', { status: 404 }));
    if (n.revision !== body.revision) return Promise.reject(new ApiError('다른 작업에서 변경되었습니다.', { status: 409 }));
    const resolved_reports = body.action === 'save' ? 0 : n.open_report_count;
    n.history.unshift({ id: n.revision, at: new Date().toISOString(), actor_id: 1, action: body.action, reason: body.reason, before: n.events, after: body.events });
    n.events = body.events.map((e, i) => ({ ...e, id: e.id ?? Date.now() + i })); n.revision++; n.state = ({ save: 'needs_review', approve: 'approved', reject: 'rejected' })[body.action];
    if (body.action !== 'save') { n.reports.forEach(r => { r.resolved_at ||= new Date().toISOString(); }); n.open_report_count = 0; }
    return mockResponse({ id: n.id, revision: n.revision, state: n.state, resolved_reports });
  }
  return apiRequest(`/api/admin/notices/${id}/review`, { method: 'POST', body });
}
export function getFeedback(offset, type, signal) {
  if (USE_MOCK) { const items = feedback.filter(f => type === 'all' || !type || f.type === type); return mockResponse({ total: items.length, counts: Object.fromEntries(['all', 'inconvenience', 'suggestion', 'praise', 'other'].map(t => [t, feedback.filter(f => t === 'all' || f.type === t).length])), items: items.slice(offset, offset + 50) }); }
  return apiRequest(`/api/admin/feedback?limit=50&offset=${offset}${type && type !== 'all' ? `&type=${encodeURIComponent(type)}` : ''}`, { signal });
}
