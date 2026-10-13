import { useEffect, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { getEventDetail } from '../../services/eventService';
import NoticeTimeline from './NoticeTimeline';
import { ExternalLinkIcon } from '../icons';
import './events.css';

export default function EventExpand({ event, hideActions = false, notificationTargetId }) {
  const { events, calendarEvents, actionBusy, saveBookmark, requestRegistration,
    unregisterDetailEvent, setDismissed, syncEvent, showUndo } = useAppData();
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDetail(null); setDetailError('');
    getEventDetail(event.id).then((value) => { if (!cancelled) setDetail(value); })
      .catch((error) => { if (!cancelled) setDetailError(error.message); });
    return () => { cancelled = true; };
  }, [event.id, events, calendarEvents, retry]);
  const mine = event.registered || event.bookmarked;
  const [pending, setPending] = useState(null);
  const run = async (key, action) => { setPending(key); try { return await action(); } finally { setPending(null); } };
  const label = (key, idle, busy) => (pending === key ? busy : idle);
  const removeRegistration = async (item, interview = false) => {
    if (await run('unregister', () => unregisterDetailEvent(item.id))) showUndo('등록을 해제했어요. Google 캘린더에서도 빠져요.', () => requestRegistration(item.id, interview));
  };
  return <div className={`event-expand ${hideActions ? 'without-actions' : ''}`} aria-busy={actionBusy}>
    <div className="event-expand-content">
      {event.detail && <p className="event-summary" title={event.detail}>{event.detail}</p>}
      {event.review_required && <p className="event-warning">공지에서 날짜를 한 번 확인해 주세요.</p>}
      {!hideActions && event.registered && ['needs_sync', 'failed'].includes(event.sync_status) && <p className="event-sync">
        수정한 내용이 Google 캘린더에 아직 반영되지 않았어요. <button type="button" className="event-link" disabled={actionBusy} onClick={() => syncEvent(event.id)}>다시 반영</button>
      </p>}
      {!detail && !detailError && <p className="event-meta" role="status">전체 일정을 불러오는 중…</p>}
      {detailError && <p className="event-error" role="alert">{detailError} <button type="button" className="event-link" disabled={actionBusy} onClick={() => setRetry(retry + 1)}>다시 불러오기</button></p>}
      {detail && !detail.events.length && <p className="event-meta">공개된 일정이 없어요.</p>}
      {notificationTargetId && detail && detail.events.length > 0 && !detail.events.some(item => String(item.id) === String(notificationTargetId))
        && <p className="event-error" role="alert">알림 대상 일정은 현재 상세에서 확인할 수 없어요.</p>}
      <NoticeTimeline items={detail?.events || []} currentId={event.id} notificationTargetId={notificationTargetId} editable={mine} showActions={!hideActions} />
      {hideActions && event.source_url && <a className="event-original" href={event.source_url} target="_blank" rel="noreferrer">원문 보기 <ExternalLinkIcon /></a>}
    </div>
    {!hideActions && <div className="event-actions">
      {!event.registered && <button type="button" className={`event-button ${event.bookmarked ? 'is-saved' : ''}`} aria-pressed={event.bookmarked} disabled={actionBusy} onClick={() => run('save', () => saveBookmark(event.id, !event.bookmarked))}>{event.bookmarked ? '저장됨' : '관심 저장'}</button>}
      {event.event_type !== 'interview' && (event.registered
        ? <button type="button" className="event-button quiet" disabled={actionBusy} aria-busy={pending === 'unregister' || undefined} onClick={() => removeRegistration(event)}>{label('unregister', '등록 해제', '해제 중…')}</button>
        : <button type="button" className="event-button primary" disabled={actionBusy || event.can_register === false} aria-busy={pending === 'register' || undefined} onClick={() => run('register', () => requestRegistration(event.id))}>{label('register', '일정 등록', '등록 중…')}</button>)}
      {!event.registered && event.can_register === false && <p className="event-meta">{event.registration_reason}</p>}
      <button type="button" className="event-button quiet" disabled={actionBusy} onClick={async () => {
        if (await run('dismiss', () => setDismissed(event.id, true))) showUndo('공지를 숨겼어요.', () => setDismissed(event.id, false));
      }}>{label('dismiss', '관심 없음', '숨기는 중…')}</button>
      {event.source_url && <a className="event-original" href={event.source_url} target="_blank" rel="noreferrer">원문 보기 <ExternalLinkIcon /></a>}
    </div>}
  </div>;
}
