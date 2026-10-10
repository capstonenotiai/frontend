export const ENROLLMENT_OPTIONS = [['enrolled', '재학'], ['expected_graduation', '졸업 예정'], ['leave', '휴학'], ['graduated', '졸업'], ['unknown', '선택 안 함']];
export const NOTIFICATION_OPTIONS = [['d3', '마감 3일 전'], ['d1', '마감 하루 전'], ['email', '이메일로도 받기']];
export const REPORT_REASONS = [['date', '날짜'], ['time', '시각'], ['location', '장소'], ['nonexistent', '없는 일정'], ['other', '기타']];
export const FEEDBACK_TYPES = [['inconvenience', '불편한 점'], ['suggestion', '기능 제안'], ['praise', '칭찬'], ['other', '기타']];
export const SOURCE_IDS = ['cbnu', 'wevity', 'contestkorea'];

export function buildProfileBody({ major = '', grade = null, enrollment_status = 'unknown' } = {}) {
  if (typeof major !== 'string' || major.length > 255) throw new Error('전공은 255자까지 입력할 수 있어요.');
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 6)) throw new Error('학년은 1~6 또는 선택 안 함으로 골라 주세요.');
  if (!ENROLLMENT_OPTIONS.some(([id]) => id === enrollment_status)) throw new Error('재학 상태를 다시 골라 주세요.');
  return { major, grade, enrollment_status };
}

export function buildPreferencesBody(preferences) {
  return {
    interests: [...(preferences.interests ?? [])],
    enabled_sources: Object.fromEntries(SOURCE_IDS.map(id => [id, preferences.enabled_sources?.[id] !== false])),
    notifications: Object.fromEntries(NOTIFICATION_OPTIONS.map(([id]) => [id, preferences.notifications?.[id] !== false])),
  };
}

export function canToggleSource(sources, id, value) {
  return SOURCE_IDS.includes(id) && (value || SOURCE_IDS.some(other => other !== id && sources[other] !== false));
}

export function welcomeKey(email) { return `notiai.welcome.done.${email}`; }
export function shouldShowWelcome(profile, preferences, storage) {
  if (typeof profile?.onboarding_done === 'boolean') return profile.onboarding_done === false;
  if (!profile?.email || profile.major !== '' || profile.grade !== null || profile.enrollment_status !== 'unknown' || !Array.isArray(preferences?.interests) || preferences.interests.length) return false;
  try { return !storage?.getItem(welcomeKey(profile.email)); } catch { return true; }
}
export function completeWelcome(email, storage) {
  try { storage?.setItem(welcomeKey(email), '1'); } catch { /* 저장 제한에도 홈으로 이동 */ }
}

export function buildReportBody(reason, memo = '') {
  if (!REPORT_REASONS.some(([id]) => id === reason)) throw new Error('신고 이유를 다시 골라 주세요.');
  if (typeof memo !== 'string' || memo.length > 2000) throw new Error('메모는 2000자까지 입력할 수 있어요.');
  return { reason, memo };
}
export function buildFeedbackBody({ type, message, replyEmail }) {
  if (!FEEDBACK_TYPES.some(([id]) => id === type)) throw new Error('의견 종류를 다시 골라 주세요.');
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw new Error('내용을 1~2000자로 입력해 주세요.');
  return { type, message: message.trim(), ...(replyEmail ? { reply_email: replyEmail } : {}) };
}

/** 실패가 뒤 요청을 막지 않는 묶음별 직렬 큐. */
export function createSaveQueue() {
  let tail = Promise.resolve();
  return task => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
}
