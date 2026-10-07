import { useEffect, useState } from 'react';
import { getEventDetail } from '../services/eventService';
import './RegisterConfirmDialog.css';

const FIELDS = [['start_date', '시작일', 'date'], ['end_date', '종료·마감일', 'date'],
  ['start_time', '시작 시각', 'time'], ['end_time', '종료·마감 시각', 'time'], ['location', '장소', 'text']];
const TYPES = { application: '접수', submission: '제출', event: '본행사', interview: '면접' };

export default function RegisterConfirmDialog({ request, busy, onCancel, onConfirm }) {
  const [items, setItems] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setItems(null); setOverrides({}); setChecked(false); setError('');
    getEventDetail(request.id).then((detail) => {
      if (cancelled) return;
      const targets = detail.events.filter((e) => request.interview ? e.id === request.id :
        e.event_type !== 'interview' && !['result', 'service_change', 'award', 'survey'].includes(e.event_type)
        && e.schedule_status !== 'cancelled' && ['auto', 'approved'].includes(e.review_status));
      setItems(targets);
      setOverrides(Object.fromEntries(targets.map((e) => [e.id, Object.fromEntries(FIELDS.map(([key]) => [key, e[key] || '']))])));
    }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [request.id, request.interview]);

  return <div className="confirm-backdrop">
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title">캘린더 등록 전 확인</h2>
      <p>원문과 날짜·시각·장소를 대조해 주세요. 수정한 내용은 내 일정에만 적용됩니다.</p>
      {!request.interview && <p>면접은 함께 등록되지 않습니다. 상세 화면에서 별도로 추가할 수 있습니다.</p>}
      {!items && !error && <p role="status">일정을 불러오는 중…</p>}
      <form onSubmit={async (e) => {
        e.preventDefault(); if (busy || !checked) return;
        setError('');
        const changes = Object.fromEntries((items || []).map((item) => [item.id,
          Object.fromEntries(FIELDS.filter(([key]) => (overrides[item.id]?.[key] || '') !== (item[key] || ''))
            .map(([key]) => [key, overrides[item.id][key]]))]).filter(([, patch]) => Object.keys(patch).length));
        const ok = await onConfirm(changes);
        if (!ok) setError('등록하지 못한 일정이 있습니다. 화면의 오류와 수정 값을 확인한 뒤 다시 시도해 주세요.');
      }}>
        {(items || []).map((item) => <fieldset key={item.id} disabled={busy}>
          <legend>{TYPES[item.event_type] || '일정'} · {item.title}</legend>
          {item.ai_extracted && <span>AI 추출 · </span>}
          <a href={item.source_url || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!item.source_url) e.preventDefault(); }}>원문 확인</a>
          {item.review_required && <p className="confirm-warning">원문 확인 · {item.review_reason}</p>}
          <div className="confirm-fields">{FIELDS.map(([key, label, type]) => <label key={key}>
            {label}<input type={type} value={overrides[item.id]?.[key] || ''} maxLength={key === 'location' ? 255 : undefined}
              onChange={(e) => setOverrides((prev) => ({ ...prev, [item.id]: { ...prev[item.id], [key]: e.target.value } }))} />
          </label>)}</div>
        </fieldset>)}
        <label className="confirm-check"><input type="checkbox" checked={checked} disabled={busy} onChange={(e) => setChecked(e.target.checked)} /> 원문과 등록할 정보를 확인했습니다.</label>
        {error && <p role="alert">{error}</p>}
        <div className="confirm-actions">
          <button type="button" disabled={busy} onClick={onCancel}>취소</button>
          <button type="submit" disabled={busy || !checked || !items?.length}>{busy ? '등록 중…' : '확인하고 등록'}</button>
        </div>
      </form>
    </section>
  </div>;
}
