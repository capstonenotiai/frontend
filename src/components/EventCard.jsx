import { formatRange } from '../utils/date';
import RegisterButton from './RegisterButton';
import SourceBadge from './SourceBadge';

/** 일정 목록 카드 (.sched-card) */
const URGENCY_CARD_CLASS = { hot: 'urgent', warm: 'warn-card' };
const URGENCY_DDAY_CLASS = { hot: 'hot', warm: 'warm', cool: 'cool', far: 'far', past: 'far', none: 'far' };

export default function EventCard({ event, onToggleRegister, onToggleBookmark }) {
  return (
    <div className={`sched-card ${URGENCY_CARD_CLASS[event.urgency] ?? ''}`.trim()}>
      <div className="sc-left">
        <div className={`sc-d ${URGENCY_DDAY_CLASS[event.urgency]}`}>{event.dday}</div>
      </div>
      <div className="sc-body">
        <div className="sc-title-row">
          <span className="sc-name">{event.title}</span>
          <SourceBadge source={event.source} />
          {event.is_new && <span className="sc-new">NEW</span>}
        </div>
        <div className="sc-meta">
          <span className="sc-meta-item">{formatRange(event.start_date, event.end_date, { compact: true })}</span>
          {event.location && <span className="sc-meta-item">{event.location}</span>}
        </div>
      </div>
      <div className="sc-right">
        <RegisterButton variant="full" registered={event.registered} onToggle={onToggleRegister} />
        <button
          type="button"
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
