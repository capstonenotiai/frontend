export const PLANNER_LABELS = {
  priority: { act: '지금 진행', prepare: '미리 준비', verify: '확인 필요', monitor: '추후 확인' },
  discover: { strong_match: '적극 추천', potential_match: '검토 추천', not_recommended: '추천 안 함' },
  focus: { core: '핵심', secondary: '후순위' },
};
export const SECONDARY_LABELS = { stronger_alternative: '더 적합한 대안', schedule_conflict: '일정 충돌', information_uncertain: '정보 확인 필요' };
export const LABEL_FIELDS = { priority: 'next_step_label', discover: 'grade', focus: 'tier' };
export const CACHE_TTL = 30 * 60 * 1000;
export const CHAT_GREETING = '다가오는 일정에 대해 물어보세요. 마감 전 일정 20건을 보고 답해요.';
export function plannerLabel(mode, value) { return Object.hasOwn(PLANNER_LABELS, mode) && Object.hasOwn(PLANNER_LABELS[mode], value) ? PLANNER_LABELS[mode][value] : ''; }
export function secondaryLabel(value) { return Object.hasOwn(SECONDARY_LABELS, value) ? SECONDARY_LABELS[value] : ''; }
export function countPlannerLabels(mode, items = []) {
  return Object.keys(PLANNER_LABELS[mode] ?? {}).map((value) => ({ value, label: plannerLabel(mode, value), count: items.filter((item) => item[LABEL_FIELDS[mode]] === value).length }));
}
/** 받침 있으면 '이에요', 없으면 '예요'. 한글로 끝나지 않으면 받침 없는 것으로 본다(숫자·영문 제목). */
export function withCopula(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const batchim = code >= 0 && code <= 11171 && code % 28 !== 0;
  return `${word}${batchim ? '이에요' : '예요'}`;
}

export function plannerSummary(mode, data = {}) {
  const items = data.items ?? [];
  const counts = Object.fromEntries(countPlannerLabels(mode, items).map(({ value, count }) => [value, count]));
  if (mode === 'priority') {
    const first = items[0]?.title;
    return counts.act ? `지금 진행할 일이 ${counts.act}건 있어요.${first ? ` 가장 먼저 할 일은 ${withCopula(first)}.` : ''}`
      : `지금 바로 할 일은 없어요.${first ? ` 가장 가까운 일은 ${withCopula(first)}.` : ''}`;
  }
  if (mode === 'discover') return `나에게 맞는 새 공지 ${counts.strong_match + counts.potential_match}건을 골랐어요.`;
  if (mode === 'focus') return `${counts.core}건에 먼저 집중하고, ${counts.secondary}건은 미뤄도 괜찮아요.`;
  return '';
}
export function cacheIsFresh(entry, mode, now = Date.now()) {
  const time = Date.parse(entry?.generated_at);
  return entry?.mode === mode && entry?.data?.mode === mode && Array.isArray(entry?.data?.items)
    && Number.isFinite(time) && now >= time && now - time < CACHE_TTL;
}
const cacheKey = (mode, scope) => `notiai:planner:v1:${scope}:${mode}`;
export function readPlannerCache(storage, mode, scope, now = Date.now()) {
  try {
    const entry = JSON.parse(storage?.getItem(cacheKey(mode, scope)) ?? 'null');
    return cacheIsFresh(entry, mode, now) ? entry.data : null;
  } catch { return null; }
}
export function writePlannerCache(storage, mode, scope, data) {
  try { storage?.setItem(cacheKey(mode, scope), JSON.stringify({ mode, generated_at: data.generated_at, data })); } catch { /* Storage may be blocked or full. */ }
}
export function plannerStorage() {
  try { return globalThis.sessionStorage; } catch { return null; }
}
export const REFRESH_NOTICE_MS = 5000;
export function refreshLimitMessage(error) {
  return typeof error?.data?.message === 'string' && error.data.message.trim()
    ? error.data.message : '잠시 후 다시 시도해 주세요.';
}
export function refreshFailureState(mode, previousData, error) {
  return error?.status === 429 && previousData
    ? { mode, status: 'ready', data: previousData }
    : { mode, status: 'error', error, data: null };
}
export function trimChatHistory(messages = []) {
  return messages.filter(({ role, content }) => ['user', 'assistant'].includes(role) && (Array.isArray(content) ? content.join('\n\n') : String(content ?? '')).trim())
    .slice(-12).map(({ role, content }) => ({ role, content: (Array.isArray(content) ? content.join('\n\n') : content).slice(0, 2000) }));
}
export function plannerErrorMessage(error) {
  if (error?.status === 500) return 'AI 플래너 설정이 아직 끝나지 않았어요.';
  if ([502, 503].includes(error?.status)) return 'AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.';
  if (error?.status === 400) return '추천 모드를 다시 골라 주세요.';
  if (error?.status === 413) return '요청이 너무 커요. 잠시 후 다시 시도해 주세요.';
  return 'AI 플래너 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
export function recommendationTime(value) {
  if (!Number.isFinite(Date.parse(value))) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  const hour = Number(parts.hour);
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${parts.minute}에 받은 추천, 30분 동안 저장`;
}
