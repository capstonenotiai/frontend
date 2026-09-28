/**
 * GET /api/health  (Cloudflare Pages Function)
 *
 * 서버(Functions)가 살아 있는지, OpenAI 설정이 되어 있는지 확인하는 테스트용 엔드포인트.
 *  - GET /api/health               → 서버 상태 + 설정 여부 (OpenAI 호출 없음)
 *  - GET /api/health?check=openai  → 실제로 OpenAI 에 연결해 Key/모델 확인 (토큰 비용 없음)
 *
 * ⚠️ API Key 값은 절대 응답에 포함하지 않는다. 설정 여부(true/false)만 알려준다.
 */
import { checkOpenAIConnection, DEFAULT_MODEL } from '../lib/openai.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ message: '허용되지 않는 요청 방식입니다.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, HEAD' },
    });
  }

  const body = {
    status: 'ok',
    service: 'notiai-functions',
    time: new Date().toISOString(),
    openai: {
      apiKeyConfigured: Boolean(env.OPENAI_API_KEY),
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
      modelFromEnv: Boolean(env.OPENAI_MODEL),
    },
  };

  if (new URL(request.url).searchParams.get('check') === 'openai') {
    const result = await checkOpenAIConnection(env);
    body.openai.connection = result.ok ? 'ok' : 'error';
    if (!result.ok) {
      body.openai.reason = result.reason;
      if (result.status) body.openai.providerStatus = result.status;
      body.status = 'degraded';
    }
  }

  return json(body);
}
