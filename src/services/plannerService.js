import { MOCK_CHAT_LATENCY_MS, PLANNER_USE_MOCK } from '../config/app';
import { mockActionSuggestions, mockWeeklyBriefing, buildMockRecommendations } from '../data/mockPlanner';
import { compareByDeadline, enrichEvent } from '../utils/events';
import { trimChatHistory, CHAT_GREETING } from '../utils/planner';
import { ApiError, apiRequest, mockResponse } from './apiClient';
import { mockStore } from './mockStore';

let messageSeq = 0;
export function createMessage(role, content) {
  return { id: `m${Date.now()}-${++messageSeq}`, role, content: Array.isArray(content) ? content : [content], createdAt: new Date().toISOString() };
}
export async function getGreeting() { return createMessage('assistant', CHAT_GREETING); }

const mockRefreshTimes = new Map();
/** refresh는 서버 캐시를 교체하며 사용자·모드별 60초 제한을 따른다. */
export async function getRecommendations(mode, { signal, refresh = false } = {}) {
  if (!PLANNER_USE_MOCK) return apiRequest('/api/planner/recommendations', { method: 'POST', body: { mode, ...(refresh ? { refresh: true } : {}) }, signal });
  if (signal?.aborted) throw new DOMException('요청 취소', 'AbortError');
  if (refresh) {
    const key = `${mockStore.profile.email}:${mode}`;
    const now = performance.now();
    if (mockRefreshTimes.has(key) && now - mockRefreshTimes.get(key) < 60000) throw new ApiError('잠시 후 다시 시도해 주세요.', { status: 429 });
    mockRefreshTimes.set(key, now);
  }
  await mockResponse(null, 1500);
  if (signal?.aborted) throw new DOMException('요청 취소', 'AbortError');
  let failure;
  try { failure = globalThis.sessionStorage?.getItem('notiai:planner:mock-error'); } catch { /* optional debug switch */ }
  if (['400', '401', '413', '429', '500', '502', '503'].includes(failure)) throw new ApiError('추천 mock 오류', { status: Number(failure) });
  return buildMockRecommendations(mode, mockStore.events);
}
export async function sendMessage({ message, history = [] }) {
  if (!PLANNER_USE_MOCK) {
    const data = await apiRequest('/api/planner/chat', { method: 'POST', body: { message, history: trimChatHistory(history) } });
    if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('AI 응답을 받지 못했어요.');
    return createMessage('assistant', data.reply.trim().split(/\n{2,}/));
  }
  await mockResponse(null, MOCK_CHAT_LATENCY_MS);
  if (message.includes('/error')) throw new ApiError('AI 응답을 받지 못했어요.', { status: 502 });
  const events = mockStore.events.map((event) => enrichEvent(event)).filter((event) => event.daysLeft !== null && event.daysLeft >= 0).sort(compareByDeadline).slice(0, 20);
  if (/마감|급|임박|우선/.test(message)) return createMessage('assistant', ['마감이 가까운 일정이에요.', events.slice(0, 3).map((event) => `**${event.dday}** ${event.title}`).join(' · ')]);
  if (/등록|캘린더/.test(message)) return createMessage('assistant', `다가오는 일정 중 아직 등록하지 않은 일정이 ${events.filter((event) => !event.registered).length}건 있어요. 전체 공지에서 일정 등록을 눌러 보세요.`);
  return createMessage('assistant', '다가오는 일정의 마감이나 캘린더 등록에 대해 물어보세요. 현재는 데모 응답이에요.');
}
/** 보존된 이전 화면용 mock 함수. 활성 플래너에서 사용하지 않는다. */
export async function getWeeklyBriefing() { return mockResponse(mockWeeklyBriefing); }
export async function getActionSuggestions() { return mockResponse(mockActionSuggestions); }
