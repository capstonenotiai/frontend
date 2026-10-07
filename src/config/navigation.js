/**
 * 앱(사이드바 + 탑바) 화면 구성.
 *
 * - path    : 라우트 경로 (App.jsx 에서 사용)
 * - label   : 사이드바 / 탑바 표시 이름
 * - icon    : components/icons.jsx 의 아이콘 이름
 * - section : 사이드바 그룹 ('main' | 'settings')
 * - badge   : 사이드바 뱃지 종류 (Sidebar 에서 값 계산)
 * - actions : 탑바 오른쪽 요소
 *     { kind: 'tag', text }                          — 회색 태그. text 는 문자열 또는 (ctx) => 문자열
 *     { kind: 'button', variant, label, to }         — 페이지 이동
 *     { kind: 'button', variant, label, action }     — components/Topbar.jsx 의 action 핸들러 호출
 *     action 없이 to 도 없으면 아직 기능이 없는 버튼(비활성 표시)
 */
export const APP_PAGES = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: '대시보드',
    icon: 'dashboard',
    section: 'main',
    actions: [
      { kind: 'tag', text: (ctx) => `마지막 수집 ${ctx.lastCollectedAt}` },
      { kind: 'button', variant: 'ghost', label: '새로고침', action: 'refresh' },
      { kind: 'button', variant: 'primary', label: '캘린더 연동', to: '/schedules' },
    ],
  },
  {
    id: 'schedules',
    path: '/schedules',
    label: '일정 목록',
    icon: 'list',
    section: 'main',
    badge: 'eventCount',
    actions: [
      { kind: 'tag', text: (ctx) => `총 ${ctx.eventCount}건 · 마지막 수집 ${ctx.lastCollectedAt}` },
      { kind: 'button', variant: 'ghost', label: '직접 추가' },
      { kind: 'button', variant: 'primary', label: '전체 등록', action: 'registerAll' },
    ],
  },
  {
    id: 'planner',
    path: '/planner',
    label: 'AI 플래너',
    icon: 'star',
    section: 'main',
    actions: [
      { kind: 'button', variant: 'ghost', label: '모드 변경', action: 'scrollToModes' },
      { kind: 'button', variant: 'primary', label: '전체 일정 등록', action: 'registerAll' },
    ],
  },
  {
    id: 'calendar',
    path: '/calendar',
    label: '캘린더',
    icon: 'calendar',
    section: 'main',
    actions: [
      { kind: 'tag', text: (ctx) => ctx.calendarMonthLabel },
      { kind: 'button', variant: 'ghost', label: '오늘', to: '/calendar' },
      { kind: 'button', variant: 'primary', label: '일정 추가', to: '/schedules' },
    ],
  },
  {
    id: 'curation',
    path: '/curation',
    label: '대외활동 큐레이션',
    icon: 'clock',
    section: 'main',
    actions: [{ kind: 'tag', text: '부캠 연동 · 매일 00:10 갱신' }],
  },
  {
    id: 'settings',
    path: '/settings',
    label: '설정',
    icon: 'settings',
    section: 'settings',
    actions: [{ kind: 'button', variant: 'primary', label: '저장', action: 'savePreferences' }],
  },
];

export const SIDEBAR_SECTIONS = [
  { id: 'main', label: '메뉴' },
  { id: 'settings', label: '설정' },
];

export function getAppPageByPath(pathname) {
  return APP_PAGES.find((page) => pathname === page.path || pathname.startsWith(`${page.path}/`));
}
