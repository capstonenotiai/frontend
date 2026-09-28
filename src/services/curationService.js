import { USE_MOCK } from '../config/app';
import { mockCuration } from '../data/mockCuration';
import { apiRequest, mockResponse } from './apiClient';

/**
 * 대외활동 큐레이션 (부트캠프 프로젝트 연동).
 * TODO: 실제 endpoint 미정 — 연결 시 경로와 응답 형태를 맞출 것
 */
export async function getCuration() {
  if (USE_MOCK) return mockResponse(mockCuration);
  return apiRequest('/api/curation');
}
