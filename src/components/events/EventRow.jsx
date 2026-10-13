import { getInterestCategory } from '../../config/interestCategories';
import { getSource } from '../../config/sources';
import { useAppData } from '../../context/AppDataContext';
import { enrichEvent } from '../../utils/events';
import { TYPE_LABELS } from '../../utils/eventLabels';
import { parseDate, WEEKDAYS_KO } from '../../utils/date';
import { CheckIcon } from '../icons';
import EventExpand from './EventExpand';
import './events.css';

export const categoryClass = (category) => getInterestCategory(category) ? `event-category-${category}` : 'event-category-other';
export function eventDateLabel(iso) {
  const date = parseDate(iso);
  return date ? `${date.getMonth() + 1}.${date.getDate()}(${WEEKDAYS_KO[date.getDay()]})` : '날짜 미확인';
}

export default function EventRow({ event, mode = 'new', open = false, onToggle, idPrefix = 'event', actions, hideActions = false, rowRef, notificationTargetId }) {
  const { actionBusy, setActionStatus } = useAppData();
  const display = event.dday ? event : enrichEvent(event);
  const done = event.action_status === 'done';
  const checkbox = mode === 'mine' && event.registered;
  const expandable = mode !== 'hidden';
  const detailId = `${idPrefix}-${event.id}-detail`;
  const period = event.start_date && event.end_date && event.start_date !== event.end_date
    ? `${eventDateLabel(event.start_date)} ~ ${eventDateLabel(event.end_date)}`
    : `${event.start_date ? '' : '~ '}${eventDateLabel(event.end_date || event.start_date)}`;
  const row = <div ref={rowRef} className={`event-row ${checkbox ? 'has-check' : ''} ${done && mode === 'mine' ? 'is-done' : ''}`}
    role={expandable ? 'button' : undefined} tabIndex={expandable ? 0 : undefined}
    aria-expanded={expandable ? open : undefined} aria-controls={expandable ? detailId : undefined} onClick={expandable ? onToggle : undefined}
    onKeyDown={(e) => {
      if (!expandable || e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
    }}>
    {checkbox && <button className={`event-tick ${done ? 'is-on' : ''}`} type="button" aria-label="완료 표시" aria-pressed={done}
      disabled={actionBusy} onClick={(e) => { e.stopPropagation(); setActionStatus(event.id, done ? 'pending' : 'done'); }}>
      {done && <CheckIcon />}
    </button>}
    <span className={`event-dday ${['hot', 'warm'].includes(display.urgency) ? 'is-urgent' : ''}`}>{display.dday}</span>
    <div className="event-title-group"><div className="event-title-line">
      {mode === 'new' && event.is_new && <span className="event-new">NEW</span>}
      <span className="event-title">{event.title}</span>
      {mode !== 'hidden' && event.review_required && <span className="event-review">확인 필요</span>}
    </div><div className="event-meta">{getSource(event.source).label}, {TYPE_LABELS[event.event_type] || '일정'} {period}</div></div>
    <span className={`event-category ${categoryClass(event.category)}`}><i aria-hidden="true" />{getInterestCategory(event.category)?.label || '기타'}</span>
  </div>;
  return <div className={`event-item ${open ? 'is-open' : ''} ${expandable ? '' : 'is-hidden'}`}>
    {actions ? <div className="event-row-shell">{row}<div className="event-row-actions">{actions}</div></div> : row}
    {expandable && <div id={detailId} hidden={!open}>{open && <EventExpand event={event} hideActions={hideActions} notificationTargetId={notificationTargetId} />}</div>}
    
  </div>;
}
