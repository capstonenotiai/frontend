import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';
import { mockStore } from './mockStore';

/** 사용자 기본 정보 (Google 로그인 연동 전까지 mock) — 향후 GET /api/user */
export async function getProfile() {
  if (USE_MOCK) return mockResponse(mockStore.profile);
  return apiRequest('/api/user');
}

/** 사용자 설정 (ai_mode, interests, 알림 등) — 향후 GET /api/user/preferences */
export async function getPreferences() {
  if (USE_MOCK) return mockResponse(mockStore.preferences);
  return apiRequest('/api/user/preferences');
}

/** 사용자 설정 저장 — 향후 PUT /api/user/preferences */
export async function updatePreferences(preferences) {
  if (USE_MOCK) {
    mockStore.preferences = structuredClone(preferences);
    return mockResponse(mockStore.preferences, 300);
  }
  return apiRequest('/api/user/preferences', { method: 'PUT', body: preferences });
}
