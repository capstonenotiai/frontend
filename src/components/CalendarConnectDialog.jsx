import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './CalendarConnectDialog.css';

/** 처음 일정을 등록할 때 Google 캘린더 권한을 따로 받기 전에 보여주는 안내 창. */
export default function CalendarConnectDialog({ onCancel, onConnect }) {
  const primary = useRef(null), panel = useRef(null), origin = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    origin.current = document.activeElement;
    primary.current?.focus();
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
      if (event.key === 'Tab') {
        const controls = [...panel.current.querySelectorAll('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); origin.current?.focus?.(); };
  }, [onCancel]);
  const content = <div className="calendar-connect-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section ref={panel} className="calendar-connect-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="calendar-connect-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      </div>
      <h2 id={titleId}>Google 캘린더를 연결할게요</h2>
      <p id={descriptionId}>일정을 내 캘린더에 넣으려면 한 번만 권한이 필요해요. 연결이 끝나면 방금 고른 일정이 바로 등록돼요.</p>
      <ul className="calendar-connect-points">
        <li>NotiAI는 직접 등록한 일정만 추가·삭제해요</li>
        <li>Google 화면에는 "캘린더 일정 보기·수정"으로 표시돼요</li>
      </ul>
      <p className="calendar-connect-tip">Google에서 "확인하지 않은 앱" 화면이 나오면 <b>고급 → notiai.me로 이동</b>을 눌러 주세요.</p>
      <div className="calendar-connect-actions">
        <button type="button" className="calendar-connect-later" onClick={onCancel}>나중에</button>
        <button ref={primary} type="button" className="calendar-connect-go" disabled={leaving} onClick={() => { setLeaving(true); onConnect(); }}>
          {leaving ? 'Google로 이동 중…' : 'Google 캘린더 연결'}</button>
      </div>
    </section>
  </div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
