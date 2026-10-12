import { MOCK_TODAY } from '../config/app';

const mockDay = offset => new Date(Date.parse(`${MOCK_TODAY}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
/** 알림 API와 같은 형식의 데모 데이터. */
export const mockNotifications = [
  { id: '5', kind: 'event_d1', title: '내일 창업경진대회 일정', message: '행사 시간과 장소를 확인해 주세요.', event_id: 'ev1', target_date: '2026-05-22', created_at: `${mockDay(-1)}T09:00:00+09:00`, read: false },
  { id: '4', kind: 'deadline_d3', title: '광고대상 접수 마감 3일 전', message: '접수에 필요한 자료를 준비해 주세요.', event_id: 'ev2', target_date: '2026-05-28', created_at: `${mockDay(-2)}T09:00:00+09:00`, read: false },
  { id: '3', kind: 'event_d3', title: '해커톤 일정 3일 전', message: '참가 준비사항을 확인해 주세요.', event_id: 'ev3', target_date: '2026-05-22', created_at: `${mockDay(-3)}T09:00:00+09:00`, read: false },
  { id: '2', kind: 'deadline_d1', title: '스타트업 접수 마감 안내', message: '접수 마감일을 확인해 주세요.', event_id: 'ev4', target_date: '2026-05-22', created_at: `${mockDay(-4)}T09:00:00+09:00`, read: true },
  { id: '1', kind: 'event_d1', title: '등록한 일정 안내', message: '등록한 일정이 내일 시작돼요.', event_id: 'ev1', target_date: '2026-05-22', created_at: `${mockDay(-5)}T09:00:00+09:00`, read: true },
];
