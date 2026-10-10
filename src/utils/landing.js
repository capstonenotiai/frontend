export const HIGHLIGHT_ORDER = ['a', 'b', 'c'];

export function getLoginUrl(useMock, apiBaseUrl = '') {
  return useMock ? '/dashboard' : `${apiBaseUrl.replace(/\/$/, '')}/api/auth/google/login`;
}

export function nextHighlight(current, paused = false) {
  if (paused) return current;
  return HIGHLIGHT_ORDER[(HIGHLIGHT_ORDER.indexOf(current) + 1) % HIGHLIGHT_ORDER.length];
}

// 랜딩만 사용하는 고정 데이터. 앱 mock 날짜와 독립적이며 API를 호출하지 않는다.
export const LANDING_SCHEDULES = [
  { id: 'a', title: '수강신청', start: '2026-11-10', end: '2026-11-12', when: '11.10(화) 10:00 ~ 11.12(목) 17:00', original: '2026. 11. 10.(화) 10:00 ~ 11. 12.(목) 17:00', short: '수강' },
  { id: 'b', title: '등록금 납부', start: '2026-11-17', end: '2026-11-19', when: '11.17(화) ~ 11.19(목)', original: '2026. 11. 17.(화) ~ 11. 19.(목)', short: '납부' },
  { id: 'c', title: '수강 정정', start: '2026-11-24', end: '2026-11-24', when: '11.24(화)', original: '2026. 11. 24.(화)', short: '정정' },
];

export const LANDING_NOTICES = [
  { title: '2학기 교내 근로장학생 추가 모집', cat: 's', site: 'CBNU 포털', end: '2026-11-04', when: '11.4(수) 17:00', dday: 3 },
  { title: '대학생 서포터즈 12기 모집', cat: 'v', site: 'ContestKorea', end: '2026-11-10', when: '11.10(화)', dday: 9, isNew: true },
  { title: '하반기 현장실습 참여 학생 모집', cat: 'c', site: 'CBNU 포털', end: '2026-11-13', when: '11.13(금) 18:00', dday: 12 },
  { title: '2026 공개SW 개발자대회 참가 신청', cat: 'k', site: 'Wevity', end: '2026-11-20', when: '11.20(금) 23:59', dday: 19, isNew: true },
  { title: '청년 정책 아이디어 공모전', cat: 'k', site: 'ContestKorea', end: '2026-11-27', when: '11.27(금)', dday: 26, isNew: true },
];

export const LANDING_MODES = [
  { id: 'priority', name: '먼저 할 일', description: '마감과 해야 할 일을 보고 순서를 정해요.', items: [
    { notice: 0, why: '마감이 가장 가깝고 신청서만 내면 돼요.', next: '신청서 작성' },
    { notice: 2, why: '면접 준비 시간이 필요해요.', next: '자기소개서 초안' },
  ] },
  { id: 'discover', name: '새 기회', description: '아직 저장하지 않은 공지 중 나에게 맞는 것을 찾아요.', items: [
    { notice: 3, why: '관심 분야(공모전)와 전공에 맞아요.', next: '팀 구성 확인' },
    { notice: 4, why: '개인 참가가 가능하고 제출물이 짧아요.', next: '지원 조건 확인' },
  ] },
  { id: 'focus', name: '집중할 것', description: '이번 학기에 비중이 큰 일정을 골라요.', items: [
    { notice: 2, why: '학점과 진로 준비에 함께 도움이 돼요.', next: '면접 일정 등록' },
    { title: '동계 계절학기 수강신청 안내', dday: 30, why: '졸업 학점 계획과 이어져 있어요.', next: '들을 과목 정하기' },
  ] },
];
