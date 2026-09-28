import { getSource } from '../config/sources';
import RegisterButton from './RegisterButton';

/** 대시보드 '임박 마감' 한 줄 (.deadline-item) */
export default function DeadlineItem({ event, onToggleRegister }) {
  return (
    <div className="deadline-item">
      <div className="dl-badge-wrap">
        <div className={`dl-d ${event.urgency === 'hot' ? 'hot' : 'warm'}`}>{event.dday}</div>
      </div>
      <div className="dl-info">
        <div className="dl-name">{event.title}</div>
        <div className="dl-meta">
          <span className="dl-src">{getSource(event.source).label}</span>· {event.end_date}
        </div>
      </div>
      <RegisterButton registered={event.registered} onToggle={onToggleRegister} />
    </div>
  );
}
