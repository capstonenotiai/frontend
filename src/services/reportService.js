import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';

export function listMyReports() {
  return USE_MOCK ? mockResponse([
    { id: 2, event_id: 'ev1', title: '2026학년도 장학금 신청', reason: 'date', memo: '원문에는 마감일이 5월 22일로 나와 있어요.\n날짜를 확인해 주세요.', status: 'received', created_at: '2026-05-19T03:00:00+00:00' },
    { id: 1, event_id: 'ev2', title: '취업 특강', reason: 'location', memo: '강의실이 변경됐어요.', status: 'resolved', created_at: '2026-05-18T02:00:00+00:00' },
  ]) : apiRequest('/api/reports/mine');
}
