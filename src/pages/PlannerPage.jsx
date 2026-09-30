import Badge from '../components/Badge';
import Card from '../components/Card';
import ChatPanel from '../components/ChatPanel';
import ModeSelector from '../components/ModeSelector';
import { AI_MODES } from '../config/aiModes';
import { getOverallCrawlStatus } from '../config/crawlStatus';
import { getSource } from '../config/sources';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { useAsync } from '../hooks/useAsync';
import * as plannerService from '../services/plannerService';

export default function PlannerPage() {
  const { summary } = useAppData();
  const { activeMode, setAiMode } = useUser();
  const briefing = useAsync(() => plannerService.getWeeklyBriefing(), []);
  const actions = useAsync(() => plannerService.getActionSuggestions(), []);

  return (
    <>
      <div className="page-header">
        <div className="page-title">AI 플래너</div>
        <div className="page-sub">AI가 분석한 일정 우선순위와 추천 모드를 확인하세요</div>
      </div>

      {/* 모드 목록은 config/aiModes.js 에서 관리 (현재 Study/Explorer/Balanced 는 임시) */}
      <ModeSelector id="planner-modes" modes={AI_MODES} activeId={activeMode.id} onSelect={setAiMode} />

      <ChatPanel mode={activeMode} />

      <div className="planner-grid" style={{ marginTop: 16 }}>
        <Card
          title="7일 브리핑"
          headerRight={
            <div className="week-nav">
              <button type="button" className="week-arr" aria-label="이전 주" title="준비 중인 기능입니다">
                ‹
              </button>
              <span>{briefing.data?.rangeLabel}</span>
              <button type="button" className="week-arr" aria-label="다음 주" title="준비 중인 기능입니다">
                ›
              </button>
            </div>
          }
          bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          {(briefing.data?.items ?? []).map((item) => (
            <div className="brief-row" key={item.dateLabel}>
              <div className={`brief-dot ${item.urgency}`} />
              <div className="brief-body">
                <div className="brief-date">{item.dateLabel}</div>
                {item.title ? (
                  <div className="brief-card">
                    <span className="brief-name">{item.title}</span>
                    {item.tags.map((tag) => (
                      <Badge key={tag.label} tone={tag.tone} style={{ fontSize: 9.5 }}>
                        {tag.label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="brief-card empty">일정 없음</div>
                )}
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card
            title="수집 현황"
            headerRight={
              <Badge tone={getOverallCrawlStatus(summary?.sources).tone}>
                {getOverallCrawlStatus(summary?.sources).label}
              </Badge>
            }
          >
            {(summary?.sources ?? []).map((item) => (
              <div className="cc-row" key={item.source}>
                <div className="cc-name">{getSource(item.source).label}</div>
                <div className="cc-count">{item.count}</div>
                <div className="cc-bar">
                  <div className="cc-fill" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            ))}
          </Card>

          <Card
            title="AI 액션 제안"
            headerRight={<Badge tone="blue">{actions.data?.length ?? 0}건</Badge>}
            bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 9 }}
          >
            {(actions.data ?? []).map((item) => (
              <div className="action-item" key={item.id}>
                <div className={`action-dot ${item.tone}`} />
                <div className="action-text">{item.text}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
