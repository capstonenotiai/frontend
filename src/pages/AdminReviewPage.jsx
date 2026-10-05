import { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useAppData } from '../context/AppDataContext';
import * as admin from '../services/adminService';
import '../styles/admin.css';

const defaults = { title: '', start_date: '', end_date: '', start_time: '', end_time: '', timezone: 'Asia/Seoul', location: '', detail: '', event_type: 'event', attendance_mode: 'unknown', schedule_status: 'confirmed' };
const fields = { title: '일정 제목', start_date: '시작일', end_date: '종료일 / 마감일', start_time: '시작 시각', end_time: '종료 / 마감 시각', timezone: '시간대', location: '물리적 장소', detail: '상세 내용' };
const choices = {
  event_type: ['일정 종류', { application: '접수', submission: '제출', event: '본행사', result: '결과 발표', service_change: '서비스 변경' }],
  attendance_mode: ['참여 방식', { unknown: '확인 필요', offline: '오프라인', online: '온라인', hybrid: '온·오프라인', not_applicable: '해당 없음' }],
  schedule_status: ['진행 상태', { confirmed: '확정', tentative: '예정', cancelled: '취소', unknown: '확인 필요' }],
};
const toEdit = (event) => ({ id: event.id, ...Object.fromEntries(Object.keys(defaults).map((key) => [key, event[key] ?? defaults[key]])) });

export default function AdminReviewPage() {
  const { profile, status } = useUser();
  const { refresh } = useAppData();
  const [filter, setFilter] = useState('needs_review');
  const [offset, setOffset] = useState(0);
  const [queue, setQueue] = useState({ items: [], total: 0 });
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);
  const [events, setEvents] = useState([]);
  const [reason, setReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const saving = useRef(false);

  useEffect(() => {
    if (!profile.is_admin) return;
    const controller = new AbortController();
    admin.getQueue(filter, offset, controller.signal).then(setQueue).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [profile.is_admin, filter, offset, version]);

  useEffect(() => {
    if (!profile.is_admin || selected === null) return;
    const controller = new AbortController();
    setNotice(null);
    admin.getNotice(selected, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setNotice(data); setEvents(data.events.filter((e) => e.review_status !== 'rejected').map(toEdit)); setReason(''); setDirty(false);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [profile.is_admin, selected, version]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const discard = () => !dirty || window.confirm('저장하지 않은 수정 내용을 버릴까요?');
  const change = (index, key, value) => { setEvents((all) => all.map((e, i) => i === index ? { ...e, [key]: value } : e)); setDirty(true); };
  const submit = async (action) => {
    if (saving.current || !notice) return;
    if (!reason.trim()) { setError('검수 사유를 입력해 주세요.'); return; }
    if (action === 'reject' && !window.confirm('이 공지의 모든 일정을 제외할까요? 기존 등록 사용자에게 변경 사항이 표시됩니다.')) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await admin.reviewNotice(notice.id, { revision: notice.revision, action, reason, events: action === 'reject' ? [] : events });
      setDirty(false); setMessage('검수 결과를 저장했습니다.'); setVersion((v) => v + 1); await refresh();
    } catch (e) { setError(e.status === 409 ? '다른 작업에서 수정되었습니다. 입력 내용은 유지했습니다. 새로 불러온 뒤 다시 검수해 주세요.' : e.message); }
    finally { saving.current = false; setBusy(false); }
  };

  if (status === 'loading') return <p>권한 확인 중…</p>;
  if (!profile.is_admin) return <p role="alert">관리자 계정으로 로그인해야 접근할 수 있습니다.</p>;
  const safeUrl = notice && /^https?:\/\//i.test(notice.source_url) ? notice.source_url : null;
  return <div className="admin-review">
    <h1>일정 검수</h1>
    <p>원문에서 접수와 본행사의 날짜·장소를 각각 확인한 후 승인하세요. 온라인 접수 주소를 행사 장소로 입력하지 않습니다.</p>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="admin-columns">
      <aside className="admin-queue">
        <label>검수 상태 <select value={filter} disabled={busy} onChange={(e) => { setFilter(e.target.value); setOffset(0); }}>
          {['needs_review', 'failed', 'pending', 'processing', 'approved', 'rejected', 'extracted', 'all'].map((s) => <option key={s}>{s}</option>)}
        </select></label>
        <p>총 {queue.total}건</p>
        {queue.items.map((n) => <button type="button" key={n.id} disabled={busy} aria-pressed={selected === n.id} onClick={() => { if (discard()) { if (selected === n.id) setVersion((v) => v + 1); setSelected(n.id); setDirty(false); setError(''); setMessage(''); } }}>{n.title}<small>{n.source} · {n.state}</small></button>)}
        <div className="admin-actions"><button disabled={offset === 0 || busy} onClick={() => setOffset((v) => Math.max(0, v - 30))}>이전</button><button disabled={offset + 30 >= queue.total || busy} onClick={() => setOffset((v) => v + 30)}>다음</button></div>
      </aside>
      <section>
        {!notice ? <p>{selected === null ? '검수할 공지를 선택하세요.' : '원문을 불러오는 중…'}</p> : <>
          <h2>{notice.title}</h2>
          {safeUrl && <a href={safeUrl} target="_blank" rel="noreferrer">원문 열기</a>}
          <details open><summary>수집한 원문</summary><pre>{notice.body || '본문 없음 — 원문 링크를 확인하세요.'}</pre></details>
          {notice.error && <p role="alert">추출 오류: {notice.error}</p>}
          <details><summary>모델 출력 원본</summary><pre>{JSON.stringify(notice.model_output, null, 2)}</pre></details>
          <fieldset disabled={busy || notice.state === 'processing'}>
            <legend>일정 편집</legend>
            {events.map((event, index) => <div className="admin-event" key={event.id ?? `new-${index}`}>
              <h3>일정 {index + 1}</h3>
              <div className="admin-fields">
                {Object.entries(choices).map(([key, [label, options]]) => <label key={key}>{label}<select value={event[key]} onChange={(e) => change(index, key, e.target.value)}>{Object.entries(options).map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>)}
                {Object.entries(fields).map(([key, label]) => <label key={key}>{label}<input type={key.endsWith('_date') ? 'date' : key.endsWith('_time') ? 'time' : 'text'} value={event[key]} onChange={(e) => change(index, key, e.target.value)} /></label>)}
              </div>
              <button type="button" onClick={() => { setEvents((all) => all.filter((_, i) => i !== index)); setDirty(true); }}>이 일정 제외</button>
            </div>)}
            <button type="button" onClick={() => { setEvents((all) => [...all, { ...defaults, title: notice.title }]); setDirty(true); }}>일정 추가</button>
            <label>검수 사유 (필수)<textarea value={reason} onChange={(e) => { setReason(e.target.value); setDirty(true); }} /></label>
            <p>승인한 일정만 공개됩니다. 날짜가 불명확하거나 취소된 일정은 캘린더에 새로 등록할 수 없습니다.</p>
            <div className="admin-actions">
              <button onClick={() => submit('save')}>검토 중으로 저장</button>
              <button onClick={() => submit('approve')}>승인 및 공개</button>
              <button onClick={() => submit('reject')}>공지 전체 제외</button>
            </div>
          </fieldset>
          <button disabled={busy} onClick={() => { if (discard()) { setDirty(false); setError(''); setVersion((v) => v + 1); } }}>새로 불러오기</button>
          <details><summary>검수 이력 ({notice.history.length})</summary>{notice.history.map((log) => <article key={log.id}><p>{log.at} · 관리자 #{log.actor_id} · {log.action}: {log.reason}</p><pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></article>)}</details>
        </>}
      </section>
    </div>
  </div>;
}
