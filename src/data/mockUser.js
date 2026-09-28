/**
 * 사용자 mock.
 *
 * User = { name, email, interests: [], ai_mode }
 *  - profile      : Google 로그인 후 받아올 기본 정보 (향후 GET /api/user)
 *  - preferences  : 사용자가 바꾸는 설정 (향후 GET/PUT /api/user/preferences)
 *
 * interests / ai_mode 의 최종 저장 방식은 미정 — 현재는 id 문자열(배열)로 가정.
 *  - interests : config/interestCategories.js 의 id 배열
 *  - ai_mode   : config/aiModes.js 의 id
 */
export const mockProfile = {
  name: '김학생',
  email: 'student@cbnu.ac.kr',
};

export const mockPreferences = {
  ai_mode: 'study',
  interests: [],
  enabled_sources: {
    cbnu: true,
    wevity: true,
    contestkorea: true,
  },
  notifications: {
    d7: true,
    d3: true,
    new_event: false,
  },
  auto_mode_recommend: true,
};
