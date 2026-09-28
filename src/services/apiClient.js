import { API_BASE_URL, MOCK_LATENCY_MS } from '../config/app';

/**
 * 백엔드 API 호출 공통 함수.
 * 아직 백엔드 endpoint 가 확정되지 않았으므로 현재는 USE_MOCK=false 일 때만 사용됩니다.
 *
 * ⚠️ 이 파일(브라우저 코드)에는 API Key / 토큰 / Secret 을 절대 넣지 마세요.
 *    인증은 백엔드 세션 쿠키(credentials: 'include') 방식을 가정합니다.
 */
export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      // 응답 본문이 JSON 이 아닌 경우 무시
    }
    throw new ApiError(data?.message || `요청 실패 (${response.status})`, { status: response.status, data });
  }

  if (response.status === 204) return null;
  return response.json();
}

/** mock 응답: 실제 API 처럼 비동기로, 원본이 바뀌지 않도록 복사본을 돌려준다 */
export function mockResponse(data, delay = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data === undefined ? null : structuredClone(data)), delay);
  });
}
