import { formatRange } from '../utils/date';
import RegisterButton from './RegisterButton';
import SourceBadge from './SourceBadge';
import { useAppData } from '../context/AppDataContext';

/** 일정 목록 카드 (.sched-card) */
const URGENCY_CARD_CLASS = { hot: 'urgent', warm: 'warn-card' };
const URGENCY_DDAY_CLASS = { hot: 'hot', warm: 'warm', cool: 'cool', far: 'far', past: 'far', none: 'far' };

export default function EventCard({ event, onToggleRegister, onToggleBookmark, onSelect, busy = false }) {
  const { setDismissed } = useAppData();
  return (
    <div className={`sched-card ${URGENCY_CARD_CLASS[event.urgency] ?? ''}`.trim()} onClick={onSelect}>
      <div className="sc-left">
        <div className={`sc-d ${URGENCY_DDAY_CLASS[event.urgency]}`}>{event.dday}</div>
      </div>
      <div className="sc-body">
        <div className="sc-title-row">
          <button type="button" className="sc-name notice-detail-link">{event.title}</button>
          <SourceBadge source={event.source} />
          {event.is_new && <span className="sc-new">NEW</span>}
        </div>
        <div className="sc-meta">
          <span className="sc-meta-item">{formatRange(event.start_date, event.end_date, { compact: true })}</span>
          {event.location && <span className="sc-meta-item">{event.location}</span>}
        </div>
      </div>
      <div className="sc-right" onClick={(e) => e.stopPropagation()}>
        <RegisterButton variant="full" registered={event.registered} onToggle={onToggleRegister} disabled={busy} />
        {event.notice_id != null && <button type="button" disabled={busy} onClick={() => setDismissed(event.id, !event.dismissed)}>{event.dismissed ? '관심 없음 되돌리기' : '관심 없음'}</button>}
        <button
          type="button"
          disabled={busy}
          className={`bookmark-btn ${event.bookmarked ? 'on' : ''}`.trim()}
          aria-pressed={event.bookmarked}
          aria-label={event.bookmarked ? '북마크 해제' : '북마크'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark();
          }}
        >
          {event.bookmarked ? '★' : '☆'}
        </button>
      </div>
    </div>
  );
}
