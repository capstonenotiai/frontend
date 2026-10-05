import { getSource } from '../config/sources';
import { URGENCY_PILL_TONE, formatMonthDay, parseDate } from '../utils/date';
import Badge from './Badge';
import EventReviewStatus from './EventReviewStatus';

/** 캘린더 하단 상세 패널 (.cal-detail) — 일정 상세 또는 '일정 없음' */
export default function EventDetailPanel({ event, date, onClose }) {
  if (!event && !date) return null;

  const closeButton = (
    <button type="button" className="cal-detail-close" aria-label="닫기" onClick={onClose} style={{ background: 'none', border: 'none' }}>
      ✕
    </button>
  );

  if (!event) {
    return (
      <div className="cal-detail">
        <div className="cal-detail-head">
          <div className="cal-detail-title">
            {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}일
          </div>
          {closeButton}
        </div>
        <div style={{ color: 'var(--t3)', fontSize: 13 }}>등록된 일정이 없습니다.</div>
      </div>
    );
  }

  const year = parseDate(event.start_date || event.end_date)?.getFullYear();
  const period = [event.start_date && formatMonthDay(event.start_date), formatMonthDay(event.end_date)]
    .filter(Boolean)
    .join(' ~ ');

  return (
    <div className="cal-detail">
      <div className="cal-detail-head">
        <span className="cal-detail-src">{getSource(event.source).label}</span>
        <div className="cal-detail-title">{event.title}</div>
        <Badge tone={URGENCY_PILL_TONE[event.urgency]} style={{ marginLeft: 8 }}>
          {event.dday}
        </Badge>
        {closeButton}
      </div>
      <div className="cal-detail-meta">
        {year}년 {event.start_date ? '' : '~ '}
        {period}
        {event.location && ` · ${event.location}`}
      </div>
      <div className="cal-detail-ai">
        <b>일정 안내</b> · {event.detail || '상세 내용은 원문 공지를 확인하세요.'}
      </div>
      <EventReviewStatus event={event} />
    </div>
  );
}
