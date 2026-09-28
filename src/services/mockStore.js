import { mockEvents } from '../data/mockEvents';
import { mockPreferences, mockProfile } from '../data/mockUser';

/**
 * mock 모드 전용 "가짜 서버" 상태.
 * 등록/북마크/설정 변경이 '새로고침' 후에도 유지되도록 services 들이 이 객체를 공유한다.
 * (브라우저 새로고침 시에는 초기화됨 — DB 가 아님)
 */
export const mockStore = {
  events: structuredClone(mockEvents),
  profile: structuredClone(mockProfile),
  preferences: structuredClone(mockPreferences),
};

export function updateMockEvent(id, patch) {
  const event = mockStore.events.find((item) => item.id === id);
  if (!event) throw new Error(`일정을 찾을 수 없습니다: ${id}`);
  Object.assign(event, patch);
  return event;
}
