import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { formatKoreanToday, getToday } from '../utils/date';
import * as notificationService from '../services/notificationService';
import { BellIcon } from './icons';
import NotificationPanel from './NotificationPanel';

export default function Topbar({ page }) {
  const { profile, sourcesVersion } = useUser();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef(null);
  const containerRef = useRef(null);
  const countRequest = useRef(0);
  const refreshCount = useCallback(async () => {
    const request = ++countRequest.current;
    try {
      const { count } = await notificationService.getUnreadCount();
      if (request === countRequest.current) setUnreadCount(count);
    } catch { /* 목록 오류는 패널에서 다시 시도할 수 있다. 기존 배지는 유지한다. */ }
  }, []);
  useEffect(() => {
    refreshCount();
    return () => { countRequest.current += 1; };
  }, [refreshCount, sourcesVersion]);
  const closePanel = useCallback(() => {
    setOpen(false);
    bellRef.current?.focus();
    refreshCount();
  }, [refreshCount]);
  useEffect(() => { if (open) closePanel(); }, [page?.id]); // 화면 이동 시에도 닫는다.
  const name = profile.name?.trim();
  return (
    <header className="topbar">
      <div className="tb-heading">
        <h1 className="tb-title">{page?.id === 'dashboard' ? (name ? `안녕하세요, ${name}님` : '안녕하세요') : page?.label}</h1>
        {page?.id === 'dashboard' && <div className="tb-date">{formatKoreanToday(getToday())}</div>}
      </div>
      <div className="tb-r" ref={containerRef}>
        <button type="button" className="notification-bell" ref={bellRef}
          aria-label={unreadCount ? `알림 ${unreadCount}개` : '알림'}
          aria-expanded={open} aria-controls="notification-panel"
          onClick={() => open ? closePanel() : setOpen(true)}>
          <BellIcon />
          {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
        {open && <NotificationPanel id="notification-panel" containerRef={containerRef}
          unreadCount={unreadCount} onClose={closePanel} onCountChange={(count) => {
            countRequest.current += 1;
            setUnreadCount(count);
          }} />}
      </div>
    </header>
  );
}
