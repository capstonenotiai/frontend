import { useState } from 'react';
import { useAppData } from '../context/AppDataContext';

const labels = { application: '접수', submission: '제출', event: '본행사', result: '결과 발표', service_change: '서비스 변경' };
export default function EventReviewStatus({ event }) {
  const { syncEvent } = useAppData();
  const [busy, setBusy] = useState(false);
  const changed = event.registered && ['needs_sync', 'failed'].includes(event.sync_status);
  const removed = event.review_status === 'rejected' || event.schedule_status === 'cancelled';
  return <div style={{ fontSize: 12, marginTop: 8 }}>
    <span>{labels[event.event_type] || '일정'}{event.attendance_mode === 'online' ? ' · 온라인' : ''}{event.schedule_status === 'tentative' ? ' · 예정' : ''}</span>
    {(event.start_time || event.end_time) && <span> · {event.start_time ? `시작 ${event.start_time}` : ''}{event.end_time ? ` 종료/마감 ${event.end_time}` : ''} ({event.timezone})</span>}
    {!event.can_register && <p>{event.registration_reason || '일정 확인이 필요합니다.'}</p>}
    {changed && <div role="status">
      <span>{removed ? '취소·제외된 일정입니다.' : event.sync_status === 'failed' ? '캘린더 반영에 실패했습니다.' : '관리자가 일정을 수정했습니다.'} 내 캘린더에 반영해 주세요. </span>
      <button type="button" disabled={busy || (!removed && !event.can_register)} onClick={async (e) => { e.stopPropagation(); if (busy) return; setBusy(true); try { await syncEvent(event.id); } finally { setBusy(false); } }}>{busy ? '반영 중…' : removed ? '내 캘린더에서 제거' : '변경 반영'}</button>
    </div>}
  </div>;
}
