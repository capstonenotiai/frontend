import { API_BASE_URL, MOCK_CHAT_LATENCY_MS, PLANNER_USE_MOCK } from '../config/app';
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
const toParagraphs = (text) => text.trim().split(/\n{2,}/);

/**
 * 채팅 답변을 생성되는 대로 받는다. onDelta(지금까지의 전체 텍스트)를 조각마다 호출하고,
 * 끝나면 sendMessage 와 같은 메시지 객체를 돌려준다.
 * 스트리밍 엔드포인트가 없거나(404) JSON 으로 답하면 기존 sendMessage 결과로 대신한다.
 */
export async function streamMessage({ message, history = [], onDelta, signal } = {}) {
  if (PLANNER_USE_MOCK) return sendMessage({ message, history });
  const response = await fetch(`${API_BASE_URL}/api/planner/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, history: trimChatHistory(history) }),
    credentials: 'include',
    signal,
  });
  if (response.status === 404) return sendMessage({ message, history });
  if (!response.ok) {
    let data = null;
    try { data = await response.json(); } catch { /* JSON 이 아닌 오류 본문 */ }
    throw new ApiError(data?.message || `요청 실패 (${response.status})`, { status: response.status, data });
  }
  if (!(response.headers.get('content-type') || '').includes('text/event-stream') || !response.body) {
    const data = await response.json();
    if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('AI 응답을 받지 못했어요.');
    return createMessage('assistant', toParagraphs(data.reply));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '';
  const handle = (block) => {
    let event = 'message', data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trimStart();
    }
    if (!data) return null;
    const payload = JSON.parse(data);
    if (event === 'delta' && typeof payload.text === 'string') {
      text += payload.text;
      onDelta?.(text);
    } else if (event === 'done' && typeof payload.reply === 'string' && payload.reply.trim()) {
      return createMessage('assistant', toParagraphs(payload.reply));
    } else if (event === 'error') {
      throw new ApiError(payload.message || 'AI 응답을 받지 못했어요.', { status: payload.status || 502, data: payload });
    }
    return null;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');
      let index;
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const result = handle(block);
        if (result) return result;
      }
      if (done) break;
    }
    const result = buffer.trim() && handle(buffer);
    if (result) return result;
  } finally {
    reader.cancel().catch(() => {});
  }
  throw new ApiError('답변이 중간에 끊겼어요.', { status: 502 });
}

/** 보존된 이전 화면용 mock 함수. 활성 플래너에서 사용하지 않는다. */
export async function getWeeklyBriefing() { return mockResponse(mockWeeklyBriefing); }
export async function getActionSuggestions() { return mockResponse(mockActionSuggestions); }
