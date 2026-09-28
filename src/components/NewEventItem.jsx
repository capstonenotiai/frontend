import { URGENCY_PILL_TONE, formatRange } from '../utils/date';
import Badge from './Badge';
import RegisterButton from './RegisterButton';
import SourceBadge from './SourceBadge';

/** 대시보드 '신규 수집 일정' 한 줄 (.new-item) */
export default function NewEventItem({ event, onToggleRegister }) {
  return (
    <div className="new-item">
      <SourceBadge source={event.source} variant="dashboard" />
      <div className="new-info">
        <div className="new-name">{event.title}</div>
        <div className="new-period">{formatRange(event.start_date, event.end_date)}</div>
      </div>
      <div className="new-r">
        <Badge tone={URGENCY_PILL_TONE[event.urgency]}>{event.dday}</Badge>
        <RegisterButton registered={event.registered} onToggle={onToggleRegister} />
      </div>
    </div>
  );
}
