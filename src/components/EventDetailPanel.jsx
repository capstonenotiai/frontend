import { getSource } from '../config/sources';
import { URGENCY_PILL_TONE, formatMonthDay, parseDate } from '../utils/date';
import Badge from './Badge';

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
        <b>AI 요약</b> ·{' '}
        {event.detail ||
          '파인튜닝된 모델이 이 공지의 시작일, 종료일, 장소, 세부 정보를 자동으로 추출했습니다.'}{' '}
        마감이 가까워지면 D-7·D-3 알림이 자동으로 발송됩니다.
      </div>
    </div>
  );
}
