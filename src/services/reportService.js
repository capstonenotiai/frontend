import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';

export function listMyReports() {
  return USE_MOCK ? mockResponse([]) : apiRequest('/api/reports/mine');
}
