export const PLANNER_LABELS = {
  priority: { act: '지금 진행', prepare: '미리 준비', verify: '확인 필요', monitor: '추후 확인' },
  discover: { strong_match: '적극 추천', potential_match: '검토 추천', not_recommended: '추천 안 함' },
  focus: { core: '핵심', secondary: '후순위' },
};
export const SECONDARY_LABELS = { stronger_alternative: '더 적합한 대안', schedule_conflict: '일정 충돌', information_uncertain: '정보 확인 필요' };
export const LABEL_FIELDS = { priority: 'next_step_label', discover: 'grade', focus: 'tier' };
export const CACHE_TTL = 30 * 60 * 1000;
export const CHAT_GREETING = '안녕하세요, NotiAI예요. 마감이 다가오는 공지나 내 일정을 물어보세요.';
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
// 알림 설정·화면용 AI 모드는 추천 입력이 아니다. 순서만 다른 관심분야도 같은 입력이다.
export function plannerUserInputKey(profile = {}, preferences = {}) {
  return JSON.stringify([profile.major ?? '', profile.grade ?? null, profile.enrollment_status ?? 'unknown',
    [...new Set(preferences.interests ?? [])].sort(),
    plannerSourceInputKey(preferences)]);
}
export function plannerSourceInputKey(preferences = {}) {
  return JSON.stringify(['cbnu', 'wevity', 'contestkorea'].map(id => preferences.enabled_sources?.[id] !== false));
}
const EVENT_INPUT_FIELDS = ['id', 'notice_id', 'title', 'detail', 'source', 'source_url', 'category',
  'start_date', 'end_date', 'start_time', 'end_time', 'timezone', 'location', 'event_type',
  'attendance_mode', 'schedule_status', 'revision', 'review_status', 'review_required',
  'review_reason', 'can_register', 'registered', 'bookmarked', 'action_status', 'dismissed', 'is_new'];
export function plannerEventInputKey(events = [], calendar = [], hidden = []) {
  return JSON.stringify([events, calendar, hidden].map(items => items
    .map(event => JSON.stringify(EVENT_INPUT_FIELDS.map(field => event[field] ?? null))).sort()));
}
export function invalidatePlannerCache(storage, scope, inputKey) {
  for (const mode of Object.keys(PLANNER_LABELS)) {
    try {
      const key = cacheKey(mode, scope);
      const entry = JSON.parse(storage?.getItem(key) ?? 'null');
      if (entry && entry.inputKey !== inputKey) storage?.removeItem(key);
    } catch { /* Storage may be blocked or malformed. Reads still reject mismatched inputs. */ }
  }
}
export function readPlannerCache(storage, mode, scope, now = Date.now(), inputKey) {
  try {
    const entry = JSON.parse(storage?.getItem(cacheKey(mode, scope)) ?? 'null');
    return (inputKey === undefined || entry?.inputKey === inputKey) && cacheIsFresh(entry, mode, now) ? entry.data : null;
  } catch { return null; }
}
export function writePlannerCache(storage, mode, scope, data, inputKey) {
  try { storage?.setItem(cacheKey(mode, scope), JSON.stringify({ mode, generated_at: data.generated_at, data, inputKey })); } catch { /* Storage may be blocked or full. */ }
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
/** 서버의 사용 제한 안내(하루 횟수·전체 사용량 소진, 잠시 후 재시도)는 서버 문구를 그대로 보여준다. */
export function aiLimitMessage(error) {
  const message = error?.data?.message;
  if (typeof message !== 'string' || !message.trim()) return '';
  if (error.status === 429) return message;
  if (error.status === 503 && message.includes('오늘')) return message;
  return '';
}

export function plannerErrorMessage(error) {
  const limited = aiLimitMessage(error);
  if (limited) return limited;
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

/** 추천 항목의 일정(서버 형식 e123 / 앱 형식 123)을 찾고, 없으면 같은 공지(o45 → notice_id 45)의 일정으로 찾는다. */
export function findPlannerEvent(item, events = []) {
  const raw = String(item?.focus_event_id ?? '');
  const plain = /^e\d+$/.test(raw) ? raw.slice(1) : raw;
  const notice = /^o\d+$/.test(String(item?.opportunity_id ?? '')) ? String(item.opportunity_id).slice(1) : null;
  return (raw && events.find((event) => String(event.id) === raw || String(event.id) === plain))
    || (notice && events.find((event) => String(event.notice_id) === notice)) || null;
}

const WEEKDAYS = '일월화수목금토';
function monthDay(value) {
  const [y, m, d] = String(value || '').split('-').map(Number);
  return y && m && d ? `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})` : '';
}
/** 먼저 할 일의 기한 한 줄: 접수·제출은 "11/19(목) 16:00까지", 행사·면접은 "11/18(수) 10:00 진행". 확인 필요는 표시하지 않는다. */
export function actionDeadline(item, event) {
  if (!item?.action_date || item.next_step_label === 'verify') return '';
  const day = item.action_date;
  const attend = ['event', 'interview'].includes(event?.event_type);
  const time = !attend && day === item.end_date ? item.end_time : day === item.start_date ? item.start_time : '';
  const label = [monthDay(day), time].filter(Boolean).join(' ');
  return label ? `${label}${attend ? ' 진행' : '까지'}` : '';
}

/** 집중할 것 비교 묶음: 핵심 하나 + 그 핵심이 이긴(chosen_over)·겹치는(conflicts_with) 후순위. 나머지는 rest. */
export function buildFocusGroups(items = []) {
  const byId = new Map(items.map((item) => [item.opportunity_id, item]));
  const used = new Set();
  const groups = [];
  const free = (id) => byId.has(id) && !used.has(id) && byId.get(id).tier === 'secondary';
  for (const core of items.filter((item) => item.tier === 'core')) {
    const id = core.opportunity_id;
    const conflicts = [...new Set([...(core.conflicts_with ?? []),
      ...items.filter((item) => (item.conflicts_with ?? []).includes(id)).map((item) => item.opportunity_id)])].filter(free);
    const similar = (core.chosen_over ?? []).filter((other) => free(other) && !conflicts.includes(other));
    if (!conflicts.length && !similar.length) continue;
    [id, ...conflicts, ...similar].forEach((value) => used.add(value));
    groups.push({ kind: conflicts.length ? 'time' : 'similar', chosen: core, others: [...conflicts, ...similar].map((value) => byId.get(value)) });
  }
  return { groups, rest: items.filter((item) => !used.has(item.opportunity_id)) };
}

const ELIGIBILITY_LABELS = { eligible: '확인됨', needs_check: '확인 필요', unknown: '정보 없음', ineligible: '해당 안 됨' };
export function eligibilityLabel(value) { return ELIGIBILITY_LABELS[value] ?? '정보 없음'; }

/** 비교표 일시 칸: 11/18(수) 14:00 / 11/18(수) 10:00~17:00 / 11/25(수)~11/29(일) */
export function scheduleLabel(item = {}) {
  const { start_date: sd, end_date: ed, start_time: st, end_time: et } = item;
  if (sd && ed && sd !== ed) return `${monthDay(sd)}~${monthDay(ed)}`;
  const day = monthDay(sd || ed);
  const time = st && et && st !== et ? `${st}~${et}` : st || et || '';
  return [day, time].filter(Boolean).join(' ') || '날짜 미정';
}

function seoulParts(value) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
/** 서버가 준 겹치는 일정 [시작, 끝] (ISO) → "11/18(수) 14:00~16:00", 종일이면 "11/18(수)" */
export function slotLabel(slot) {
  if (!Array.isArray(slot) || slot.length < 2 || Number.isNaN(Date.parse(slot[0]))) return '';
  const start = seoulParts(slot[0]), end = seoulParts(slot[1]);
  return start.time === '00:00' && end.time === '00:00' ? monthDay(start.date) : `${monthDay(start.date)} ${start.time}~${end.time}`;
}
/** 화면용 제목: 앞의 [말머리]를 뗀다 */
export function plainTitle(title = '') { return String(title).replace(/^(\s*\[[^\]]*\])+\s*/, '') || String(title); }
