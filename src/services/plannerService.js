import { MOCK_CHAT_LATENCY_MS, PLANNER_USE_MOCK } from '../config/app';
import { getAiMode } from '../config/aiModes';
import { mockActionSuggestions, mockGreetings, mockWeeklyBriefing } from '../data/mockPlanner';
import { compareByDeadline, enrichEvent } from '../utils/events';
import { ApiError, apiRequest, mockResponse } from './apiClient';
import { mockStore } from './mockStore';

/**
 * AI 플래너 service.
 *
 * ⚠️ 프론트에서 OpenAI / Claude / Gemini 등 LLM API 를 직접 호출하지 않습니다.
 *    PLANNER_USE_MOCK=false 이면 POST /api/planner/chat (Cloudflare Pages Function,
 *    functions/api/planner/chat.js) 이 서버에서 OpenAI 를 호출합니다.
 *
 * Message 형태: { id, role: 'assistant' | 'user', content: string[], createdAt }
 *   content 는 문단 배열, **굵게** 표기만 사용 (components/RichText.jsx)
 */

let messageSeq = 0;
export function createMessage(role, content) {
  messageSeq += 1;
  return {
    id: `m${Date.now()}-${messageSeq}`,
    role,
    content: Array.isArray(content) ? content : [content],
    createdAt: new Date().toISOString(),
  };
}

/** 모드 첫 인사 메시지 */
export async function getGreeting(modeId) {
  const mode = getAiMode(modeId);
  const content = mockGreetings[mode.id] ?? [`안녕하세요! ${mode.name}로 설정되어 있어요.`, '무엇이 궁금하신가요?'];
  return createMessage('assistant', content);
}

/**
 * 메시지 전송 — POST /api/planner/chat
 *
 * 계약: message = 이번 사용자 메시지, history = 그 "이전" 대화만 (현재 메시지는 포함하지 않음)
 * @param {{ message: string, modeId: string, history: Array }} params
 * @returns {Promise<Message>} assistant 메시지
 */
export async function sendMessage({ message, modeId, history }) {
  if (!PLANNER_USE_MOCK) {
    let data;
    try {
      data = await apiRequest('/api/planner/chat', {
        method: 'POST',
        body: {
          message,
          mode: modeId,
          history: history.map(({ role, content }) => ({ role, content: content.join('\n\n') })),
        },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error; // 서버가 준 { message } 를 그대로 표시
      throw new Error('AI 플래너 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('AI 응답 생성에 실패했습니다.');
    }
    return createMessage('assistant', data.reply.trim().split(/\n{2,}/));
  }

  await mockResponse(null, MOCK_CHAT_LATENCY_MS);
  // 에러 UI 확인용: '/error' 를 포함해 보내면 실패 응답을 흉내낸다
  if (message.includes('/error')) {
    throw new Error('AI 플래너 응답을 받지 못했어요. (mock 에러)');
  }
  return createMessage('assistant', buildMockReply(message, modeId));
}

/** 키워드 기반 임시 응답 (실제 LLM 아님) */
function buildMockReply(message, modeId) {
  const mode = getAiMode(modeId);
  const events = mockStore.events
    .map((event) => enrichEvent(event))
    .filter((event) => event.daysLeft !== null && event.daysLeft >= 0)
    .sort(compareByDeadline);

  if (/마감|급|임박|우선/.test(message)) {
    const top = events.slice(0, 3).map((event) => `**${event.dday}** ${event.title}`);
    return [`${mode.name} 기준으로 마감이 가까운 일정이에요.`, top.join(' · '), '가장 급한 일정부터 준비해 보세요.'];
  }
  if (/등록|캘린더/.test(message)) {
    const unregistered = events.filter((event) => !event.registered);
    return [
      `아직 캘린더에 등록하지 않은 일정이 **${unregistered.length}건** 있어요.`,
      '일정 목록에서 "캘린더 등록" 버튼으로 바로 추가할 수 있어요.',
    ];
  }
  return [
    `"${message}"에 대한 답변은 AI 플래너 백엔드가 연결되면 제공될 예정이에요.`,
    `현재는 **데모(mock) 응답**입니다. (모드: ${mode.name})`,
  ];
}

/** 7일 브리핑 (mock) */
export async function getWeeklyBriefing() {
  return mockResponse(mockWeeklyBriefing);
}

/** AI 액션 제안 (mock) */
export async function getActionSuggestions() {
  return mockResponse(mockActionSuggestions);
}
