import OpenAI from 'openai';

export const DEFAULT_MODEL = 'gpt-6-luna';
const DEFAULT_MAX_OUTPUT_TOKENS = 800;

export class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ProviderError';
    this.status = status; // 브라우저에 돌려줄 HTTP status
  }
}

/**
 * OpenAI Responses API 호출 (Cloudflare 서버 측에서만 실행).
 *
 * @param {object} env  Cloudflare Pages 환경변수 (OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MAX_OUTPUT_TOKENS)
 * @param {{ instructions: string, input: Array<{role: string, content: string}> }} params
 * @returns {Promise<string>} 응답 텍스트
 */
export async function createPlannerReply(env, { instructions, input }) {
  if (!env.OPENAI_API_KEY) {
    // 키 값 자체는 절대 로그/응답에 남기지 않는다
    console.error('[planner/chat] OPENAI_API_KEY is not configured');
    throw new ProviderError('AI 플래너 서버 설정이 완료되지 않았습니다.', 500);
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 25 * 1000,
  });

  const maxOutputTokens = Number(env.OPENAI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS;

  let response;
  try {
    response = await client.responses.create({
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
      instructions,
      input,
      store: false,
      max_output_tokens: maxOutputTokens,
    });
  } catch (error) {
    // raw error body 는 브라우저로 보내지 않고, 서버 로그에도 최소 정보만 남긴다
    console.error('[planner/chat] OpenAI request failed', {
      status: error?.status ?? null,
      code: error?.code ?? null,
      type: error?.type ?? null,
      requestId: error?.requestID ?? null,
    });
    if (error?.status === 429) {
      throw new ProviderError('요청이 많아 잠시 후 다시 시도해 주세요.', 503);
    }
    throw new ProviderError('AI 응답 생성에 실패했습니다.', 502);
  }

  const text = (response.output_text || '').trim();
  if (!text) {
    console.error('[planner/chat] Empty OpenAI output', {
      status: response.status ?? null,
      incompleteReason: response.incomplete_details?.reason ?? null,
    });
    throw new ProviderError('AI 응답 생성에 실패했습니다.', 502);
  }
  return text;
}
