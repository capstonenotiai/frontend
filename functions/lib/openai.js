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

/**
 * OpenAI 연결 확인 (GET /api/health?check=openai).
 * 모델 정보 조회(models.retrieve)만 하므로 토큰 비용이 들지 않는다.
 * API Key 가 유효한지 + OPENAI_MODEL 이 이 계정에서 사용 가능한지 확인.
 *
 * @returns {Promise<{ ok: boolean, reason?: string, status?: number }>}
 */
export async function checkOpenAIConnection(env) {
  if (!env.OPENAI_API_KEY) return { ok: false, reason: 'OPENAI_API_KEY 가 설정되지 않았습니다.' };

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 10 * 1000 });
  try {
    await client.models.retrieve(env.OPENAI_MODEL || DEFAULT_MODEL);
    return { ok: true };
  } catch (error) {
    const status = error?.status ?? null;
    console.error('[health] OpenAI check failed', { status, code: error?.code ?? null });
    const reasons = {
      401: 'API Key 가 올바르지 않습니다.',
      403: '이 API Key 로는 접근 권한이 없습니다.',
      404: '모델을 찾을 수 없습니다. OPENAI_MODEL 값을 확인하세요.',
      429: '요청 한도 초과 또는 크레딧 부족입니다.',
    };
    return { ok: false, status, reason: reasons[status] ?? 'OpenAI 에 연결하지 못했습니다.' };
  }
}
