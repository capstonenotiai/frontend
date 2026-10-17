import { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useAppData } from '../context/AppDataContext';
import * as admin from '../services/adminService';
import { SOURCES } from '../config/sources';
import { REPORT_REASONS } from '../utils/settings';
import '../styles/admin.css';
const states = { needs_review: '검토 필요', reported: '신고됨', failed: '추출 실패', pending: '대기', processing: '처리 중', approved: '승인', rejected: '거절', extracted: '추출 완료', all: '전체' };
const stateLabel = value => states[value] || ({ retry_pending: '재시도 대기', no_events: '일정 없음' }[value]) || '확인 필요';
const sourceLabel = value => SOURCES.find(s => s.id === value)?.label || '기타';
const dateLabel = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('ko-KR') : '날짜 정보가 없어요';

function FeedbackList() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [offset, setOffset] = useState(0), [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    admin.getFeedback(offset, controller.signal).then(next => {
      if (!controller.signal.aborted) setData(previous => ({ total: next.total, items: offset === 0 ? next.items : [...previous.items, ...next.items.filter(item => !previous.items.some(old => old.id === item.id))] }));
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, attempt]);
  return <section className="admin-feedback" aria-label="서비스 의견 목록" aria-busy={loading}>
    <div className="admin-section-heading"><h2>서비스 의견</h2><span>최신순 · 총 {data.total}건</span></div>
    {data.items.map(item => <article className="admin-feedback-item" key={item.id}><div className="admin-section-heading"><span className="admin-chip">{({ inconvenience: '불편', suggestion: '제안', praise: '칭찬', other: '기타' })[item.type] || '기타'}</span><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></div><p>{item.message}</p>{item.reply_email && <a href={`mailto:${item.reply_email}`}>{item.reply_email}</a>}</article>)}
    {loading && <p role="status">의견을 불러오고 있어요…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(v => v + 1)}>다시 시도</button></div>}
    {!loading && !error && !data.items.length && <p>아직 도착한 의견이 없어요.</p>}
    {!error && data.items.length < data.total && <button disabled={loading} onClick={() => setOffset(data.items.length)}>더 보기</button>}
  </section>;
}


const defaults = { title: '', start_date: '', end_date: '', start_time: '', end_time: '', timezone: 'Asia/Seoul', location: '', detail: '', event_type: 'event', attendance_mode: 'unknown', schedule_status: 'confirmed' };
const fields = { title: '일정 제목', start_date: '시작일', end_date: '종료일 / 마감일', start_time: '시작 시각', end_time: '종료 / 마감 시각', timezone: '시간대', location: '물리적 장소', detail: '상세 내용' };
const choices = {
  event_type: ['일정 종류', { application: '접수', submission: '제출', event: '본행사', interview: '면접', orientation: '발대식', result: '결과 발표 (서비스에서 제외)', service_change: '서비스 변경' }],
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
  const [tab, setTab] = useState('review');
  const [queueLoading, setQueueLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const queueButtons = useRef(new Map()), backButton = useRef(null);
  useEffect(() => {
    if (selected !== null && window.matchMedia('(max-width: 768px)').matches) backButton.current?.focus();
  }, [selected]);
  const leaveDetail = () => {
    if (busy || !discard()) return;
    setSelected(null); setNotice(null); setDirty(false); setError(''); setMessage('');
    const id = selected;
    requestAnimationFrame(() => queueButtons.current.get(id)?.focus());
  };

  useEffect(() => {
    if (!profile.is_admin) return;
    const controller = new AbortController();
    setQueueLoading(true); setError(''); setQueue({ items: [], total: 0 });
    admin.getQueue(filter, offset, controller.signal).then(data => { if (!controller.signal.aborted) setQueue(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setQueueLoading(false); });
    return () => controller.abort();
  }, [profile.is_admin, filter, offset, version]);

  useEffect(() => {
    if (!profile.is_admin || selected === null) return;
    const controller = new AbortController();
    setNotice(null); setDetailError('');
    admin.getNotice(selected, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setNotice(data); setEvents(data.events.filter((e) => e.review_status !== 'rejected').map(toEdit)); setReason(''); setDirty(false);
    }).catch((e) => { if (!controller.signal.aborted) setDetailError(e.message); });
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
    if (saving.current || !notice || notice.state === 'processing') return;
    if (!reason.trim()) { setError('검수 사유를 입력해 주세요.'); return; }
    if (action === 'reject' && !window.confirm('이 공지의 모든 일정을 제외할까요? 기존 등록 사용자에게 변경 사항이 표시돼요.')) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await admin.reviewNotice(notice.id, { revision: notice.revision, action, reason, events: action === 'reject' ? [] : events });
      setDirty(false); setMessage('검수 결과를 저장했어요.'); setVersion((v) => v + 1); await refresh();
    } catch (e) { setError(e.status === 409 ? '다른 작업에서 수정되었어요. 입력 내용은 유지했어요. 새로 불러온 뒤 다시 검수해 주세요.' : e.message); }
    finally { saving.current = false; setBusy(false); }
  };

  if (status === 'loading') return <p role="status">권한을 확인하고 있어요…</p>;
  if (!profile.is_admin) return <p role="alert">관리자 계정으로 로그인해 주세요.</p>;
  const safeUrl = notice && /^https?:\/\//i.test(notice.source_url) ? notice.source_url : null;
  return <div className={`admin-review ${selected !== null && tab === 'review' ? 'admin-detail-open' : ''}`}>
    <header className="admin-heading"><h1>관리자 검토</h1><p>원문에서 접수와 본행사의 날짜·장소를 확인해 주세요.</p></header>
    <nav className="admin-tabs" aria-label="관리자 메뉴">{[['review', '일정 검수'], ['feedback', '서비스 의견']].map(([id, label]) => <button key={id} aria-pressed={tab === id} disabled={busy} onClick={() => { if (tab !== id && discard()) { setTab(id); setDirty(false); setSelected(null); setNotice(null); setError(''); setMessage(''); } }}>{label}</button>)}</nav>
    {error && <p role="alert" className="admin-error">{error}{!notice && <button disabled={busy} onClick={() => setVersion(v => v + 1)}>다시 시도</button>}</p>}
    {message && <p role="status">{message}</p>}
    {tab === 'feedback' ? <FeedbackList /> : <div className="admin-columns">
      <aside className="admin-queue">
        <nav className="admin-filters" aria-label="검수 상태">{Object.entries(states).map(([id, label]) => <button key={id} disabled={busy} aria-pressed={filter === id} onClick={() => { if (filter !== id && discard()) { setFilter(id); setOffset(0); setSelected(null); setNotice(null); setDirty(false); } }}>{label}</button>)}</nav>
        <p className="admin-count">총 {queue.total}건</p>
        {queueLoading ? <p role="status">공지 목록을 불러오고 있어요…</p> : !queue.items.length ? !error && <p>이 상태의 공지가 없어요.</p> : queue.items.map(n => <button ref={node => { if (node) queueButtons.current.set(n.id, node); else queueButtons.current.delete(n.id); }} className="admin-queue-item" type="button" key={n.id} disabled={busy} aria-pressed={selected === n.id} onClick={() => { if (discard()) { if (selected === n.id) setVersion(v => v + 1); setSelected(n.id); setDirty(false); setError(''); setMessage(''); } }}><strong>{n.title}</strong><small>{sourceLabel(n.source)} · <span className="admin-chip">{stateLabel(n.state)}</span></small><small>{n.published_at || n.posted_at ? dateLabel(n.published_at || n.posted_at) : '게시일 정보가 없어요'}</small></button>)}
        <div className="admin-actions"><button disabled={offset === 0 || busy || queueLoading} onClick={() => { if (discard()) { setDirty(false); setOffset(v => Math.max(0, v - 30)); } }}>이전</button><button disabled={offset + 30 >= queue.total || busy || queueLoading} onClick={() => { if (discard()) { setDirty(false); setOffset(v => v + 30); } }}>다음</button></div>
      </aside>
      <section className="admin-detail" aria-label="공지 검수 상세">
        <button className="admin-back" ref={backButton} disabled={busy} onClick={leaveDetail}>목록으로 돌아가기</button>
        {detailError && <p role="alert">{detailError}<button onClick={() => setVersion(v => v + 1)}>다시 시도</button></p>}
        {!notice ? <p>{selected === null ? '검수할 공지를 선택해 주세요.' : detailError ? '상세를 불러오지 못했어요.' : '원문을 불러오고 있어요…'}</p> : <>
          <h2>{notice.title}</h2><span className="admin-chip">{stateLabel(notice.state)}</span>
          {!!notice.reports?.length && <section className="admin-reports" aria-label="신고 내역"><h3>신고 내역 · {notice.reports.length}건</h3>{notice.reports.map(report => <article key={report.id}><strong>{REPORT_REASONS.find(([id]) => id === report.reason)?.[1] || '기타'}</strong><p>{report.memo || '추가 메모가 없어요.'}</p></article>)}</section>}
          {notice.state === 'processing' && <p role="status">추출을 처리하고 있어요. 완료된 뒤 수정할 수 있어요.</p>}
          {safeUrl && <a href={safeUrl} target="_blank" rel="noreferrer">원문 열기</a>}
          <details><summary>수집한 원문</summary><pre>{notice.body || '본문이 없어요. 원문 링크를 확인해 주세요.'}</pre></details>
          {notice.error && <p role="alert">추출 오류: {notice.error}</p>}
          <details><summary>모델 출력 원본</summary><pre>{JSON.stringify(notice.model_output, null, 2)}</pre></details>
          <fieldset disabled={busy || notice.state === 'processing'}>
            <legend>일정 편집</legend>
            {events.map((event, index) => <div className="admin-event" key={event.id ?? `new-${index}`}>
              <h3>일정 {index + 1} · {choices.event_type[1][event.event_type] || '일정'}</h3>
              <dl className="admin-event-summary"><div><dt>날짜</dt><dd>{event.start_date || '확인 필요'} ~ {event.end_date || '확인 필요'}</dd></div><div><dt>시각</dt><dd>{event.start_time || '미정'} ~ {event.end_time || '미정'}</dd></div><div><dt>장소</dt><dd>{event.location || '확인 필요'}</dd></div><div><dt>확인 사유</dt><dd>{notice.events.find(e => e.id === event.id)?.review_reason || '원문과 일정을 확인해 주세요.'}</dd></div></dl>
              <div className="admin-fields">
                {Object.entries(choices).map(([key, [label, options]]) => <label key={key}>{label}<select value={event[key]} onChange={(e) => change(index, key, e.target.value)}>{Object.entries(options).map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>)}
                {Object.entries(fields).map(([key, label]) => <label key={key}>{label}<input type={key.endsWith('_date') ? 'date' : key.endsWith('_time') ? 'time' : 'text'} value={event[key]} onChange={(e) => change(index, key, e.target.value)} /></label>)}
              </div>
              <button type="button" onClick={() => { setEvents((all) => all.filter((_, i) => i !== index)); setDirty(true); }}>이 일정 제외</button>
            </div>)}
            <button type="button" onClick={() => { setEvents((all) => [...all, { ...defaults, title: notice.title }]); setDirty(true); }}>일정 추가</button>
            <label>검수 사유 (필수)<textarea value={reason} onChange={(e) => { setReason(e.target.value); setDirty(true); }} /></label>
            <p>승인한 일정만 공개돼요. 날짜가 불명확하거나 취소된 일정은 새로 등록할 수 없어요.</p>
            <div className="admin-actions">
              <button onClick={() => submit('save')}>검토 중으로 저장</button>
              <button className="admin-primary" onClick={() => submit('approve')}>승인 및 공개</button>
              <button className="admin-danger" onClick={() => submit('reject')}>거절 · 공지 전체 제외</button>
            </div>
          </fieldset>
          <button disabled={busy} onClick={() => { if (discard()) { setDirty(false); setError(''); setVersion((v) => v + 1); } }}>새로 불러오기</button>
          <details><summary>검수 이력 ({(notice.history || []).length})</summary>{(notice.history || []).map((log) => <article key={log.id}><p>{log.at} · 관리자 #{log.actor_id} · {({ save: '저장', approve: '승인', reject: '거절' })[log.action] || '검수'}: {log.reason}</p><pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></article>)}</details>
        </>}
      </section>
    </div>}
  </div>;
}
