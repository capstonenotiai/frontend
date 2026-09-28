/**
 * 일정(Event) mock 데이터 — reference/NotiAI_web_final.html 의 EVENTS 를 옮김.
 *
 * 필드 구성
 *  ── model repo 추출 결과 (LLM 출력 5필드, src/config.py SYSTEM_PROMPT 기준) ──
 *  title       : 공지 제목
 *  start_date  : 'YYYY-MM-DD' 또는 ''  (본문에 시작일이 없으면 빈 문자열)
 *  end_date    : 'YYYY-MM-DD' 또는 ''  (접수 마감일 / 행사 종료일)
 *  location    : 실제 장소 또는 ''     (온라인 접수만 있으면 빈 문자열, 온라인 행사면 '온라인')
 *  detail      : 대상·접수방법·시상 등 보조정보 (120자 이내)
 *  ── 크롤러 메타 (crawler/*.py) ──
 *  source      : 'cbnu' | 'wevity' | 'contestkorea'   (크롤러의 site 값)
 *  source_url  : 원문 URL
 *  ── 서비스 측 필드 ──
 *  id, category(config/interestCategories id), is_new, registered, bookmarked, collected_at
 *  review_status : 'auto' | 'needs_review'  (model repo scripts/cascade_infer.py 의 auto_register_status)
 *
 * source_url 은 데모용 예시 주소입니다.
 */
export const mockEvents = [
  {
    id: 'ev1',
    title: '2026 충북대학교 창업경진대회',
    start_date: '2026-05-01',
    end_date: '2026-05-22',
    location: '충북대학교 개신문화관',
    detail: '재학생 팀(2~4인) 대상, 창업지원단 홈페이지 접수. 본선 진출팀 발표 예정.',
    source: 'cbnu',
    source_url: 'https://software.cbnu.ac.kr/index.php?mid=sub0401',
    category: 'contest',
    is_new: false,
    registered: true,
    bookmarked: false,
    collected_at: '2026-05-12T09:00:00+09:00',
    review_status: 'auto',
  },
  {
    id: 'ev2',
    title: '제27회 대한민국 대학생 광고대상',
    start_date: '2026-05-08',
    end_date: '2026-05-25',
    location: '',
    detail: '전국 대학생 대상, 온라인 접수. 인쇄·영상·디지털 부문.',
    source: 'wevity',
    source_url: 'https://www.wevity.com/',
    category: 'contest',
    is_new: true,
    registered: false,
    bookmarked: false,
    collected_at: '2026-05-13T09:00:00+09:00',
    review_status: 'auto',
  },
  {
    id: 'ev3',
    title: '충북대 SW중심대학 해커톤',
    start_date: '2026-05-20',
    end_date: '2026-05-30',
    location: '충북대학교 공과대학',
    detail: 'SW중심대학 재학생 팀 단위 참가, 무박 2일 진행.',
    source: 'cbnu',
    source_url: 'https://software.cbnu.ac.kr/index.php?mid=sub0401',
    category: 'academic',
    is_new: true,
    registered: false,
    bookmarked: false,
    collected_at: '2026-05-14T09:00:00+09:00',
    review_status: 'auto',
  },
  {
    id: 'ev4',
    title: '2026 K-스타트업 그랜드챌린지',
    start_date: '2026-05-15',
    end_date: '2026-06-02',
    location: '서울 코엑스',
    detail: '예비·초기 창업자 대상, K-Startup 누리집 신청.',
    source: 'contestkorea',
    source_url: 'https://www.contestkorea.com/',
    category: 'activity',
    is_new: true,
    registered: false,
    bookmarked: false,
    collected_at: '2026-05-15T09:00:00+09:00',
    review_status: 'auto',
  },
  {
    id: 'ev5',
    title: '2026 대학생 UX 디자인 공모전',
    start_date: '2026-05-10',
    end_date: '2026-06-10',
    location: '온라인',
    detail: '대학(원)생 개인·팀 참가, 이메일 제출.',
    source: 'wevity',
    source_url: 'https://www.wevity.com/',
    category: 'contest',
    is_new: false,
    registered: true,
    bookmarked: true,
    collected_at: '2026-05-16T09:00:00+09:00',
    review_status: 'auto',
  },
  {
    id: 'ev6',
    title: '청년 사회혁신 아이디어 공모전',
    start_date: '2026-05-01',
    end_date: '2026-06-20',
    location: '',
    detail: '만 19~34세 청년 대상, 온라인 제출.',
    source: 'contestkorea',
    source_url: 'https://www.contestkorea.com/',
    category: 'contest',
    is_new: false,
    registered: false,
    bookmarked: false,
    collected_at: '2026-05-17T09:00:00+09:00',
    review_status: 'auto',
  },
];
