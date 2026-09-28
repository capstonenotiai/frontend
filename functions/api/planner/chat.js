/**
 * POST /api/planner/chat  (Cloudflare Pages Function)
 *
 * React AI Planner → 이 함수 → OpenAI Responses API → { reply }
 *
 * Request : { message: string, mode: 'study' | 'explorer' | 'balanced', history: [{ role, content }] }
 * Response: 200 { reply }  /  4xx·5xx { message }
 */
import { createPlannerReply, ProviderError } from '../../lib/openai.js';
import { buildSystemPrompt } from '../../lib/prompts.js';
import { LIMITS, parseChatRequest, ValidationError } from '../../lib/validation.js';

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function readJson(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > LIMITS.bodyBytes) {
    throw new ValidationError('요청이 너무 큽니다.', 413);
  }
  const text = await request.text();
  if (text.length > LIMITS.bodyBytes) {
    throw new ValidationError('요청이 너무 큽니다.', 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError('요청 형식이 올바르지 않습니다.');
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return json({ message: '허용되지 않는 요청 방식입니다.' }, 405, { Allow: 'POST' });
  }

  try {
    const { message, mode, history } = parseChatRequest(await readJson(request));

    const reply = await createPlannerReply(env, {
      instructions: buildSystemPrompt(mode),
      input: [...history, { role: 'user', content: message }],
    });

    return json({ reply });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ProviderError) {
      return json({ message: error.message }, error.status);
    }
    console.error('[planner/chat] Unexpected error', { name: error?.name ?? 'Error' });
    return json({ message: 'AI 응답 생성에 실패했습니다.' }, 500);
  }
}
