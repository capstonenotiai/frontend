import { useNavigate } from 'react-router-dom';
import Badge from '../components/Badge';
import Card from '../components/Card';
import DeadlineItem from '../components/DeadlineItem';
import EmptyState from '../components/EmptyState';
import MiniCalendar from '../components/MiniCalendar';
import NewEventItem from '../components/NewEventItem';
import StatCard from '../components/StatCard';
import { ClockIcon, NewIcon } from '../components/icons';
import { URGENCY_DAYS } from '../config/app';
import { getCrawlStatus, getOverallCrawlStatus } from '../config/crawlStatus';
import { getSource } from '../config/sources';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { compareByDeadline, isDueWithin, shortTitle } from '../utils/events';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { events, summary, status, toggleRegister } = useAppData();
  const { profile, activeMode } = useUser();

  const sorted = [...events].sort(compareByDeadline);
  const dueSoon = sorted.filter((event) => isDueWithin(event, URGENCY_DAYS.warm));
  const newEvents = sorted.filter((event) => event.is_new);
  const hottest = sorted.find((event) => event.urgency === 'hot');
  const registeredCount = events.filter((event) => event.registered).length;
  const newUnregisteredCount = newEvents.filter((event) => !event.registered).length;
  const loading = status === 'loading' && events.length === 0;

  const viewAllButton = (
    <button type="button" className="btn-sm ghost" style={{ fontSize: 12 }} onClick={() => navigate('/schedules')}>
      전체 보기
    </button>
  );

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          {summary?.greeting ?? '안녕하세요'}, {profile.name} 님
        </div>
        <div className="page-sub">오늘의 수집 현황과 임박 일정을 확인하세요</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          {hottest && (
            <Badge tone="red" style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5 }}>
              ● {hottest.dday} {shortTitle(hottest.title)} 임박 알림
            </Badge>
          )}
          {summary && (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--t2)' }}>
              마지막 수집 {summary.lastCollectedAt} · {summary.referenceTimeLabel}
            </span>
          )}
        </div>
      </div>

      <div className="db-grid">
        <StatCard value={summary?.collectedToday ?? '-'} label="오늘 수집된 공지" change={summary?.collectedChangeLabel} tone="neutral" />
        <StatCard value={dueSoon.length} label="D-7 이내 마감" change="긴급 확인 필요" tone="warn" />
        <StatCard value={registeredCount} label="캘린더 등록됨" change="전체 일정 기준" tone="neutral" />
        <StatCard value={newUnregisteredCount} label="미등록 신규 일정" change="등록 대기 중" tone="up" />
      </div>

      <Card
        title="오늘의 수집 현황"
        headerRight={
          summary && (
            <Badge tone={getOverallCrawlStatus(summary.sources).tone}>
              {getOverallCrawlStatus(summary.sources).label} · {summary.collectionFinishedAt}
            </Badge>
          )
        }
        style={{ marginBottom: 16 }}
        bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {(summary?.sources ?? []).map((item) => {
          const source = getSource(item.source);
          return (
            <div className="src-row" key={item.source}>
              <div className="src-accent" style={{ background: source.color }} />
              <div className="src-name">{source.label}</div>
              <div className="src-bar-wrap">
                <div className="src-bar" style={{ width: `${item.progress}%`, background: source.color }} />
              </div>
              <div className="src-count">{item.count}건</div>
              <Badge tone={getCrawlStatus(item.status).tone} style={{ fontSize: 10 }}>
                {getCrawlStatus(item.status).label}
              </Badge>
            </div>
          );
        })}
      </Card>

      <div className="db-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            icon={<ClockIcon />}
            title="임박 마감"
            titleExtra={<Badge tone="red">D-7 이내 {dueSoon.length}건</Badge>}
            headerRight={viewAllButton}
          >
            {dueSoon.map((event) => (
              <DeadlineItem key={event.id} event={event} onToggleRegister={() => toggleRegister(event.id)} />
            ))}
            {dueSoon.length === 0 && <EmptyState>{loading ? '불러오는 중…' : 'D-7 이내 마감 일정이 없습니다.'}</EmptyState>}
          </Card>

          <Card
            icon={<NewIcon />}
            title="신규 수집 일정"
            titleExtra={<Badge tone="new">NEW {newEvents.length}건</Badge>}
            headerRight={viewAllButton}
          >
            {newEvents.map((event) => (
              <NewEventItem key={event.id} event={event} onToggleRegister={() => toggleRegister(event.id)} />
            ))}
            {newEvents.length === 0 && <EmptyState>{loading ? '불러오는 중…' : '새로 수집된 일정이 없습니다.'}</EmptyState>}
          </Card>
        </div>

        <div className="db-side">
          <MiniCalendar events={events} />

          <div className="ai-preview">
            <div className="ai-preview-tag">// AI PLANNER</div>
            <div className="ai-preview-mode">
              {activeMode.name} <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>활성</span>
            </div>
            <div className="ai-preview-desc">
              D-7 이내 마감 일정 {dueSoon.length}건이 있습니다. {activeMode.dashboardHint}
            </div>
            <button type="button" className="ai-preview-btn" onClick={() => navigate('/planner')}>
              주간 브리핑 보기 →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
