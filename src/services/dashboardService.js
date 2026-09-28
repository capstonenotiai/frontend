import { USE_MOCK } from '../config/app';
import { mockDashboardSummary } from '../data/mockDashboard';
import { apiRequest, mockResponse } from './apiClient';

/** 수집 현황 요약 — 향후 GET /api/dashboard */
export async function getDashboardSummary() {
  if (USE_MOCK) return mockResponse(mockDashboardSummary);
  return apiRequest('/api/dashboard');
}
