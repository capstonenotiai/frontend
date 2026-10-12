import { buildPreferencesBody } from './settings.js';

export function emptyAccountState() {
  return { profile: { name: '', email: '', major: '', grade: null, enrollment_status: 'unknown' },
    preferences: { ai_mode: 'priority', ...buildPreferencesBody({}), auto_mode_recommend: false }, saveStates: {} };
}

/** 앱 소유의 추천 캐시와 해당 계정의 이전 온보딩 기록만 지운다. */
export function clearAccountStorage(email, session, local) {
  try {
    const keys = Array.from({ length: session?.length ?? 0 }, (_, index) => session.key(index));
    for (const key of keys) if (key?.startsWith('notiai:planner:v1:')) session.removeItem(key);
  } catch { /* 저장 접근 제한 */ }
  try { local?.removeItem(`notiai.welcome.done.${email}`); } catch { /* 저장 접근 제한 */ }
}
