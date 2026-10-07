import { useState } from 'react';
import { reportEvent } from '../services/eventService';

export default function EventReportForm({ eventId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('date');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div>
    <button type="button" onClick={() => setOpen((prev) => !prev)}>정보가 틀려요</button>
    {open && <form onSubmit={async (e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
      try { await reportEvent(eventId, reason, memo); setMessage('신고를 저장했습니다.'); }
      catch (err) { setMessage(err.message); }
      finally { setBusy(false); }
    }}>
      <label>사유 <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}>
        <option value="date">날짜</option><option value="time">시각</option><option value="location">장소</option>
        <option value="nonexistent">없는 일정</option><option value="other">기타</option>
      </select></label>
      <label>메모 (선택) <textarea maxLength={2000} value={memo} disabled={busy} onChange={(e) => setMemo(e.target.value)} /></label>
      <button type="submit" disabled={busy}>{busy ? '저장 중…' : '신고 저장'}</button>
      {message && <p role="status">{message}</p>}
    </form>}
  </div>;
}
