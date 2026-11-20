/** 캘린더 권한을 처음 받을 때: 누른 등록 요청을 잠시 보관했다가 Google 에서 돌아오면 이어서 처리한다. */
export const CALENDAR_PENDING_KEY = 'notiai:calendar:pending';
export const CALENDAR_RESULT_PARAM = 'calendar';
const PENDING_TTL_MS = 30 * 60 * 1000;

export const CALENDAR_RESULT_MESSAGES = {
  denied: '캘린더 연결을 취소해서 일정을 등록하지 않았어요. 등록하려면 다시 눌러 주세요.',
  failed: 'Google 캘린더를 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  wrong_account: '로그인한 계정과 다른 Google 계정을 골랐어요. 같은 계정으로 다시 연결해 주세요.',
};

/** 돌아올 주소: 지금 화면 (이전 연결 결과 표시는 뺀다). */
export function calendarReturnPath(pathname, search = '') {
  const params = new URLSearchParams(search);
  params.delete(CALENDAR_RESULT_PARAM);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

export function calendarConnectUrl(apiBaseUrl, pathname, search) {
  return `${(apiBaseUrl || '').replace(/\/$/, '')}/api/auth/google/calendar?next=${encodeURIComponent(calendarReturnPath(pathname, search))}`;
}

export function savePendingRegistrations(storage, email, requests, now = Date.now()) {
  const items = requests.map(({ id, interview = false, editing = false, successMessage }) => ({ id: String(id), interview: !!interview, editing: !!editing, ...(successMessage ? { successMessage } : {}) }));
  try { storage?.setItem(CALENDAR_PENDING_KEY, JSON.stringify({ email, at: now, requests: items })); } catch { /* 저장 접근 제한 */ }
}

/** 보관한 요청을 꺼내고 지운다. 다른 계정이거나 오래된 요청은 버린다. */
export function takePendingRegistrations(storage, email, now = Date.now()) {
  let raw = null;
  try { raw = storage?.getItem(CALENDAR_PENDING_KEY); storage?.removeItem(CALENDAR_PENDING_KEY); } catch { return []; }
  try {
    const data = JSON.parse(raw);
    if (!data || data.email !== email || !(now - data.at < PENDING_TTL_MS) || !Array.isArray(data.requests)) return [];
    return data.requests.filter((request) => request && typeof request.id === 'string');
  } catch { return []; }
}
