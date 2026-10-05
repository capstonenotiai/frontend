import { useEffect, useState } from 'react';
import { getSource } from '../config/sources';
import { URGENCY_PILL_TONE, formatMonthDay, parseDate, formatRange } from '../utils/date';
import Badge from './Badge';
import EventReviewStatus from './EventReviewStatus';
import { getEventDetail } from '../services/eventService';
import { useAppData } from '../context/AppDataContext';
import './EventDetailPanel.css';

const TYPE_LABELS = { application: '접수', submission: '제출', event: '본행사', interview: '면접', orientation: '발대식', service_change: '서비스 변경' };

/** 캘린더 하단 상세 패널 (.cal-detail) — 일정 상세 또는 '일정 없음' */
export default function EventDetailPanel({ event, date, onClose }) {
  const { calendarEvents, actionBusy, registerInterview, unregisterDetailEvent, toggleRegister } = useAppData();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setDetail(null); setError('');
    if (event?.id) {
      getEventDetail(event.id).then((value) => { if (!cancelled) setDetail(value); })
        .catch((err) => { if (!cancelled) setError(err.message); });
    }
    return () => { cancelled = true; };
  }, [event?.id, calendarEvents]);
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
      <h3>공지 전체 일정</h3>
      <p>캘린더 등록 시 면접과 결과 발표를 제외한 일정을 함께 추가합니다. 면접은 별도로 선택하세요.</p>
      {error && <p role="alert">{error}</p>}
      {!detail && !error && <p role="status">전체 일정을 불러오는 중…</p>}
      <ul className="notice-events">
        {(detail?.events ?? []).map((item) => <li key={item.id}>
          <strong>{TYPE_LABELS[item.event_type] ?? item.event_type} · {item.title}</strong>
          <p>{formatRange(item.start_date, item.end_date)} {item.start_time}{item.end_time && ` ~ ${item.end_time}`}{item.location && ` · ${item.location}`}</p>
          {item.detail && <p>{item.detail}</p>}
          <EventReviewStatus event={item} />
          {item.event_type === 'interview' && <button type="button" className="btn-reg active"
            disabled={actionBusy || (!item.registered && !item.can_register)} title={item.registration_reason}
            onClick={() => item.registered ? unregisterDetailEvent(item.id) : registerInterview(item.id)}>
            {item.registered ? '면접 등록 해제' : '면접 캘린더에 추가'}
          </button>}
        </li>)}
      </ul>
      {event.event_type !== 'interview' && <button type="button" className="btn-reg active"
        disabled={actionBusy || (!event.registered && !event.can_register)}
        onClick={() => event.registered ? unregisterDetailEvent(event.id) : toggleRegister(event.id)}>
        {event.registered ? '공지 일정 등록 해제' : '공지 일정 함께 등록'}
      </button>}
    </div>
  );
}
