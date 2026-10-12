import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as notificationService from '../services/notificationService';
import { formatMonthDay } from '../utils/date';

export default function NotificationPanel({ id, containerRef, unreadCount, onClose, onCountChange }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const active = useRef(false);
  const lock = useRef(false);
  const loadRequest = useRef(0);
  const [items, setItems] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [failedBefore, setFailedBefore] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const load = useCallback(async (before) => {
    const request = ++loadRequest.current;
    setLoading(true);
    setError(false);
    setFailedBefore(before);
    try {
      const result = await notificationService.listNotifications({ before });
      if (!active.current || request !== loadRequest.current) return;
      setItems((current) => before ? [...current, ...result.items.filter((item) => !current.some((entry) => entry.id === item.id))] : result.items);
      setNextBefore(result.next_before);
    } catch { if (active.current && request === loadRequest.current) setError(true); }
    finally { if (active.current && request === loadRequest.current) setLoading(false); }
  }, []);
  useEffect(() => {
    active.current = true;
    panelRef.current?.focus();
    load();
    return () => { active.current = false; loadRequest.current += 1; };
  }, [load]);
  useEffect(() => {
    const outside = (event) => { if (!containerRef.current?.contains(event.target)) onClose(); };
    const escape = (event) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [containerRef, onClose]);
  const runAction = async (item) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError(false);
    try {
      if (item) {
        await notificationService.markRead(item.id);
        if (!active.current) return;
        onClose();
        navigate(`/schedules?open=${encodeURIComponent(item.event_id)}`);
      } else {
        await notificationService.markAllRead();
        if (!active.current) return;
        setItems((current) => current.map((entry) => ({ ...entry, read: true })));
        onCountChange(0);
      }
    } catch { if (active.current) setActionError(true); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  };
  return (
    <section className="notification-panel" id={id} ref={panelRef} tabIndex={-1} aria-label="알림함" aria-busy={loading || busy}>
      <div className="notification-header">
        <h2>알림</h2>
        <button type="button" className="notification-link" disabled={busy || loading || !(unreadCount || items.some((item) => !item.read))} onClick={() => runAction()}>모두 읽음</button>
      </div>
      {items.map((item) => (
        <button key={item.id} type="button" className={`notification-row${item.read ? ' read' : ' unread'}`} disabled={busy} onClick={() => runAction(item)}>
          <span className="notification-dot" aria-hidden="true" />
          <span className="notification-copy">
            <strong>{item.title}</strong>
            <span className="notification-message">{item.message}</span>
            <time dateTime={item.created_at}>{formatMonthDay(item.created_at)}</time>
          </span>
        </button>
      ))}
      {loading && <div className="notification-loading" role="status" aria-label="알림 불러오는 중">
        {[0, 1, 2].map((key) => <div key={key} className="notification-placeholder" />)}
      </div>}
      {error && <div className="notification-state" role="alert">알림을 불러오지 못했어요. <button type="button" className="notification-link" onClick={() => load(failedBefore)}>다시 시도</button></div>}
      {!loading && !error && items.length === 0 && <div className="notification-state">새 알림이 없어요.</div>}
      {actionError && <div className="notification-state" role="alert">읽음 처리하지 못했어요. 다시 눌러 주세요.</div>}
      {nextBefore && !loading && !error && <button type="button" className="notification-more" disabled={busy} onClick={() => load(nextBefore)}>더 보기</button>}
    </section>
  );
}
