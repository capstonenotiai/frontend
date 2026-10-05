import { formatRange } from '../utils/date';
import RegisterButton from './RegisterButton';
import SourceBadge from './SourceBadge';
import EventReviewStatus from './EventReviewStatus';

/** 일정 목록 카드 (.sched-card) */
const URGENCY_CARD_CLASS = { hot: 'urgent', warm: 'warn-card' };
const URGENCY_DDAY_CLASS = { hot: 'hot', warm: 'warm', cool: 'cool', far: 'far', past: 'far', none: 'far' };

export default function EventCard({ event, onToggleRegister, onToggleBookmark, onSelect, busy = false }) {
  return (
    <div className={`sched-card ${URGENCY_CARD_CLASS[event.urgency] ?? ''}`.trim()}>
      <div className="sc-left">
        <div className={`sc-d ${URGENCY_DDAY_CLASS[event.urgency]}`}>{event.dday}</div>
      </div>
      <div className="sc-body">
        <div className="sc-title-row">
          <button type="button" className="sc-name notice-detail-link" onClick={onSelect}>{event.title}</button>
          <SourceBadge source={event.source} />
          {event.is_new && <span className="sc-new">NEW</span>}
        </div>
        <div className="sc-meta">
          <span className="sc-meta-item">{formatRange(event.start_date, event.end_date, { compact: true })}</span>
          {event.location && <span className="sc-meta-item">{event.location}</span>}
        </div>
        <EventReviewStatus event={event} />
      </div>
      <div className="sc-right">
        <RegisterButton variant="full" registered={event.registered} onToggle={onToggleRegister} disabled={busy || (!event.registered && !event.can_register)} reason={event.registration_reason || '면접을 제외한 공지의 일정을 함께 등록합니다.'} />
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
