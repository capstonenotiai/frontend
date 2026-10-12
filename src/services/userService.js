import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse, ApiError } from './apiClient';
import { mockStore } from './mockStore';
import { buildPreferencesBody, buildProfileBody } from '../utils/settings';

function checkMockSave() {
  let fail = false;
  try { fail = globalThis.sessionStorage?.getItem('notiai:settings:mock-error') === '1'; } catch { /* 저장 접근 제한 */ }
  if (fail) throw new ApiError('저장 확인용 오류', { status: 503 });
}

/** Google 계정 정보와 추천용 프로필 — GET /api/user */
export async function getProfile() {
  if (USE_MOCK) return mockResponse(mockStore.profile);
  return apiRequest('/api/user');
}

/** 사용자 설정 — GET /api/user/preferences */
export async function getPreferences() {
  if (USE_MOCK) return mockResponse(mockStore.preferences);
  return apiRequest('/api/user/preferences');
}

/** 화면에서 편집하는 설정만 저장 — PUT /api/user/preferences */
export async function updatePreferences(preferences) {
  const body = buildPreferencesBody(preferences);
  if (USE_MOCK) {
    await mockResponse(null, 300);
    checkMockSave();
    mockStore.preferences = { ...mockStore.preferences, ...structuredClone(body) };
    return mockResponse(mockStore.preferences);
  }
  return apiRequest('/api/user/preferences', { method: 'PUT', body });
}

export async function updateProfile(profile) {
  const body = buildProfileBody(profile);
  if (USE_MOCK) {
    await mockResponse(null, 300);
    checkMockSave();
    mockStore.profile = { ...mockStore.profile, ...body };
    return mockResponse(mockStore.profile);
  }
  return apiRequest('/api/user/profile', { method: 'PUT', body });
}

export async function logout() {
  if (USE_MOCK) return mockResponse(null);
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function completeOnboarding() {
  if (USE_MOCK) {
    await mockResponse(null, 300);
    checkMockSave();
    mockStore.profile = { ...mockStore.profile, onboarding_done: true };
    return mockResponse(mockStore.profile);
  }
  return apiRequest('/api/user/onboarding', { method: 'PUT', body: { done: true } });
}

export async function deleteAccount() {
  if (USE_MOCK) {
    await mockResponse(null, 300);
    checkMockSave();
    mockStore.events = []; mockStore.notifications = [];
    mockStore.profile = {}; mockStore.preferences = buildPreferencesBody({});
    return null;
  }
  return apiRequest('/api/users/me', { method: 'DELETE' });
}
