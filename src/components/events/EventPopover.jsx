import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getInterestCategory } from '../../config/interestCategories';
import { useAppData } from '../../context/AppDataContext';
import { getEventDetail } from '../../services/eventService';
import { formatScheduleWhen } from '../../utils/scheduleWhen';
import { CloseIcon, ExternalLinkIcon } from '../icons';
import { categoryClass } from './EventRow';
import NoticeTimeline from './NoticeTimeline';

export function AnchoredDialog({ anchor, fallbackRef, title, onClose, children }) {
  const panel = useRef(null);
  const closeButton = useRef(null);
  const titleId = useId();
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor || !panel.current) return;
      const rect = anchor.getBoundingClientRect();
      const box = panel.current.getBoundingClientRect();
      const edge = 16, gap = 8;
      const left = Math.max(edge, Math.min(rect.left, window.innerWidth - box.width - edge));
      const below = rect.bottom + gap;
      const top = below + box.height <= window.innerHeight - edge ? below : Math.max(edge, rect.top - box.height - gap);
      setPosition({ left, top });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);
  const visible = position !== null;
  useLayoutEffect(() => {
    // 첫 렌더는 visibility:hidden이라 focus()가 무시된다. 보인 뒤 이동한다.
    if (visible) closeButton.current?.focus({ preventScroll: true });
    return () => {
      const target = anchor?.isConnected ? anchor : fallbackRef?.current;
      target?.focus({ preventScroll: true });
    };
  }, [visible, anchor, fallbackRef]);
  useEffect(() => {
    const outside = (e) => { if (!panel.current?.contains(e.target) && !anchor?.contains(e.target)) onClose(); };
    const keyboard = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const controls = [...panel.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')];
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [anchor, onClose]);
  const content = <div ref={panel} className="calendar-popover" role="dialog" aria-labelledby={titleId}
    style={{ left: position?.left ?? 16, top: position?.top ?? 16, visibility: position ? 'visible' : 'hidden' }}>
    <button ref={closeButton} type="button" className="calendar-popover-close" aria-label="닫기" onClick={onClose}><CloseIcon /></button>
    <h3 id={titleId}>{title}</h3>{children}
  </div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

export default function EventPopover({ event, anchor, fallbackRef, onClose }) {
  const { events, calendarEvents, actionBusy, actionError, syncEvent, unregisterDetailEvent, requestRegistration, showUndo } = useAppData();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDetail(null); setError('');
    getEventDetail(event.id).then((value) => { if (!cancelled) setDetail(value); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [event.id, events, calendarEvents, retry]);
  const remove = async () => {
    if (await unregisterDetailEvent(event.id)) {
      onClose();
      showUndo('등록을 해제했어요. Google 캘린더에서도 빠져요.', () => requestRegistration(event.id, event.event_type === 'interview'));
    }
  };
  return <AnchoredDialog anchor={anchor} fallbackRef={fallbackRef} title={event.title} onClose={onClose}>
    <span className={`event-category calendar-popover-category ${categoryClass(event.category)}`}><i aria-hidden="true" />{getInterestCategory(event.category)?.label || '기타'}</span>
    <p className="event-timeline-meta">{formatScheduleWhen(event)}{event.location && ` · ${event.location}`}</p>
    {event.detail && <p className="event-summary" title={event.detail}>{event.detail}</p>}
    {event.review_required && <p className="event-warning">공지에서 날짜를 한 번 확인해 주세요.</p>}
    {['needs_sync', 'failed'].includes(event.sync_status) && <p className="event-sync">수정한 내용이 Google 캘린더에 아직 반영되지 않았어요. <button type="button" className="event-link" disabled={actionBusy} onClick={() => syncEvent(event.id)}>다시 반영</button></p>}
    {!detail && !error && <p className="event-meta" role="status">전체 일정을 불러오는 중…</p>}
    {error && <p className="event-error" role="alert">{error} <button type="button" className="event-link" onClick={() => setRetry(retry + 1)}>다시 불러오기</button></p>}
    {detail && !detail.events.length && <p className="event-meta">공개된 일정이 없어요.</p>}
    <NoticeTimeline items={detail?.events || []} currentId={event.id} />
    {actionError && <p className="event-error" role="alert">{actionError.message}</p>}
    <div className="calendar-popover-actions"><button type="button" className="event-button quiet" disabled={actionBusy} onClick={remove}>등록 해제</button>
      {event.source_url && <a className="event-original" href={event.source_url} target="_blank" rel="noreferrer">원문 보기 <ExternalLinkIcon /></a>}
    </div>
  </AnchoredDialog>;
}
