import { URGENCY_PILL_TONE, formatRange } from '../utils/date';
import Badge from './Badge';
import RegisterButton from './RegisterButton';
import SourceBadge from './SourceBadge';
import EventReviewStatus from './EventReviewStatus';

/** 대시보드 '신규 수집 일정' 한 줄 (.new-item) */
export default function NewEventItem({ event, onToggleRegister }) {
  return (
    <div className="new-item">
      <SourceBadge source={event.source} variant="dashboard" />
      <div className="new-info">
        <div className="new-name">{event.title}</div>
        {event.ai_extracted && <span>AI 추출 · </span>}
        <a href={event.source_url || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!event.source_url) e.preventDefault(); }}>원문 링크</a>
        <div className="new-period">{formatRange(event.start_date, event.end_date)}</div>
        <EventReviewStatus event={event} />
      </div>
      <div className="new-r">
        <Badge tone={URGENCY_PILL_TONE[event.urgency]}>{event.dday}</Badge>
        <RegisterButton registered={event.registered} onToggle={onToggleRegister} reason="확인·수정 후 등록합니다." />
      </div>
    </div>
  );
}
