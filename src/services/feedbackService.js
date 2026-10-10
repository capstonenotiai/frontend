import { USE_MOCK } from '../config/app';
import { apiRequest, mockResponse } from './apiClient';
import { buildFeedbackBody } from '../utils/settings';

export async function sendFeedback(values) {
  const body = buildFeedbackBody(values);
  if (USE_MOCK) return mockResponse({ id: Date.now(), created_at: new Date().toISOString() }, 300);
  try { return await apiRequest('/api/feedback', { method: 'POST', body }); }
  catch (error) {
    if ([404, 405].includes(error.status)) error.message = '아직 의견을 받을 수 없어요. 곧 열게요.';
    throw error;
  }
}
