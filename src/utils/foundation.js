/** 환경설정과 UI에 의존하지 않는 공통 기반 함수. */
export function countSaved(events) {
  return events.filter((event) => event.bookmarked && !event.registered && !event.dismissed).length;
}
export function countHidden(events) {
  return events.filter((event) => event.dismissed).length;
}
export function formatKoreanToday(date) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}요일`;
}
