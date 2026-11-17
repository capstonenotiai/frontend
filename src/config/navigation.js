/** 사이드바와 상단 제목의 공통 화면 구성. */
export const APP_PAGES = [
  { id: 'dashboard', path: '/dashboard', label: '홈', icon: 'home', section: 'main' },
  { id: 'schedules', path: '/schedules', label: '전체 공지', section: 'main', parent: 'schedules' },
  { id: 'saved', path: '/schedules/saved', label: '관심 저장', section: 'main', parent: 'schedules', badge: 'saved' },
  { id: 'hidden', path: '/schedules/hidden', label: '숨긴 공지', section: 'main', parent: 'schedules', badge: 'hidden' },
  { id: 'planner', path: '/planner', label: 'AI 플래너', icon: 'spark', section: 'main' },
  { id: 'calendar', path: '/calendar', label: '캘린더', icon: 'calendar', section: 'main' },
  { id: 'settings', path: '/settings', label: '설정', icon: 'settings', section: 'settings' },
  { id: 'feedback', path: '/feedback', label: '피드백', icon: 'flag', section: 'settings' },
  { id: 'admin', path: '/admin/review', label: '관리자 검토', icon: 'list', section: 'settings', adminOnly: true },
];
export const SIDEBAR_SECTIONS = [
  { id: 'main', label: '메뉴' },
  { id: 'settings', label: '설정' },
];
// 경로·문구·관리자 권한은 APP_PAGES 한 곳에서 관리한다.
export const MOBILE_TAB_IDS = ['dashboard', 'schedules', 'planner', 'calendar'];
export const MOBILE_TABS = MOBILE_TAB_IDS.map(id => APP_PAGES.find(page => page.id === id));
export function getMorePages(isAdmin) {
  return APP_PAGES.filter(page => !MOBILE_TAB_IDS.includes(page.id) && (!page.adminOnly || isAdmin));
}
export function getAppPageByPath(pathname) {
  return [...APP_PAGES].sort((a, b) => b.path.length - a.path.length)
    .find((page) => pathname === page.path || pathname.startsWith(`${page.path}/`));
}
