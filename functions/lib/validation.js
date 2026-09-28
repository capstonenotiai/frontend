import { resolveMode } from './prompts.js';

/** 입력 제한 */
export const LIMITS = {
  bodyBytes: 64 * 1024, // 요청 본문 최대 크기
  messageChars: 3000, // 현재 메시지 최대 길이
  historyItems: 12, // OpenAI 에 보낼 최근 대화 개수
  historyContentChars: 2000, // 이전 대화 한 개당 최대 길이 (초과분은 잘라냄)
};

const HISTORY_ROLES = new Set(['user', 'assistant']);

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

/**
 * POST /api/planner/chat 요청 본문 검증 + 정리.
 *
 * 계약: message = 이번에 보낸 사용자 메시지, history = 그 이전 대화만.
 * (예전 클라이언트처럼 history 마지막에 현재 message 가 들어 있으면 한 번 제거해 중복을 막는다)
 *
 * @returns {{ message: string, mode: string, history: Array<{role: 'user'|'assistant', content: string}> }}
 */
export function parseChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('요청 형식이 올바르지 않습니다.');
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    throw new ValidationError('메시지를 입력해 주세요.');
  }
  if (message.length > LIMITS.messageChars) {
    throw new ValidationError(`메시지는 ${LIMITS.messageChars}자 이하로 입력해 주세요.`);
  }

  const mode = resolveMode(body.mode);

  // history: 배열이 아니면 빈 배열. system / developer 등 다른 role 은 무시
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .filter((item) => item && HISTORY_ROLES.has(item.role) && typeof item.content === 'string')
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, LIMITS.historyContentChars) }))
    .filter((item) => item.content.length > 0);

  const last = history[history.length - 1];
  if (last && last.role === 'user' && last.content === message) {
    history.pop();
  }

  return { message, mode, history: history.slice(-LIMITS.historyItems) };
}
