import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { dateLines } from '../utils/adminReview';
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

const feedbackTypes = { all: '전체', inconvenience: '불편', suggestion: '제안', praise: '칭찬', other: '기타' };
function FeedbackList({ type, onType, onCounts }) {
  const [data, setData] = useState({ items: [], total: 0 });
  const [offset, setOffset] = useState(0), [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    admin.getFeedback(offset, type, controller.signal).then(next => {
      if (!controller.signal.aborted) { onCounts(next.counts || {}); setData(previous => ({ total: next.total, counts: next.counts, items: offset === 0 ? next.items : [...previous.items, ...next.items.filter(item => !previous.items.some(old => old.id === item.id))] })); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, attempt, type]);
  return <section className="admin-feedback" aria-label="서비스 의견 목록" aria-busy={loading}>
    <nav className="admin-filters" aria-label="의견 종류">{Object.entries(feedbackTypes).map(([id, label]) => <button key={id} aria-pressed={type === id} onClick={() => onType(id)}>{label} <span className={!data.counts?.[id] ? 'admin-zero' : ''}>{data.counts?.[id] ?? 0}</span></button>)}</nav>
    <div className="admin-feedback-head"><span>종류</span><span>내용</span><span>회신 이메일</span><span>받은 날짜·시각</span></div>
    {data.items.map(item => <article className="admin-feedback-item" key={item.id}><span><span className="admin-chip">{feedbackTypes[item.type] || '기타'}</span></span><p>{item.message}</p><span>{item.reply_email ? <a href={`mailto:${item.reply_email}`}>{item.reply_email}</a> : '—'}</span><time dateTime={item.created_at}>{dateLabel(item.created_at)} {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></article>)}
    {loading && <p role="status">의견을 불러오고 있어요…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(v => v + 1)}>다시 시도</button></div>}
    {!loading && !error && !data.items.length && <p>아직 도착한 의견이 없어요.</p>}
    {!error && data.items.length < data.total && <button disabled={loading} onClick={() => setOffset(data.items.length)}>더 보기 ({data.items.length} / {data.total})</button>}
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
  const location = useLocation(), navigate = useNavigate(), { id: selected } = useParams();
  const params = new URLSearchParams(location.search);
  const filter = Object.hasOwn(states, params.get('state')) ? params.get('state') : 'needs_review';
  const offset = Math.max(0, Number.parseInt(params.get('offset'), 10) || 0);
  const tab = !selected && params.get('tab') === 'feedback' ? 'feedback' : 'review';
  const type = Object.hasOwn(feedbackTypes, params.get('type')) ? params.get('type') : 'all';
  const [counts, setCounts] = useState({}), [feedbackCounts, setFeedbackCounts] = useState({});
  const [adjacentBusy, setAdjacentBusy] = useState(false);
  const contextQueue = useRef(null);
  const go = (url) => { if (!busy && !adjacentBusy && discard()) { setDirty(false); setError(''); setMessage(''); navigate(url); } };
  const listUrl = (nextFilter = filter, nextOffset = offset) => `/admin/review?state=${nextFilter}&offset=${nextOffset}`;
  const detailUrl = (id, pageOffset = offset) => `/admin/review/${id}?state=${filter}&offset=${pageOffset}`;

  const [queue, setQueue] = useState({ items: [], total: 0 });
  const [notice, setNotice] = useState(null);
  const [events, setEvents] = useState([]);
  const [reason, setReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const saving = useRef(false);
  const [queueLoading, setQueueLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [sourcePanel, setSourcePanel] = useState('');
  const queueButtons = useRef(new Map()), backButton = useRef(null), returnFocus = useRef(null);
  useEffect(() => {
    if (!!selected && window.matchMedia('(max-width: 768px)').matches) backButton.current?.focus();
  }, [selected]);
  useEffect(() => {
    if (!selected && !queueLoading && returnFocus.current) {
      queueButtons.current.get(returnFocus.current)?.focus(); returnFocus.current = null;
    }
  }, [selected, queueLoading, queue]);
  const leaveDetail = () => { returnFocus.current = String(selected); go(listUrl()); };
  const move = async (direction) => {
    if (busy || adjacentBusy || !discard()) return;
    const current = contextQueue.current || { ...queue, offset };
    const index = current.items.findIndex(n => String(n.id) === String(selected));
    if (index < 0) return;
    let target = current.items[index + direction], nextOffset = current.offset;
    setAdjacentBusy(true);
    try {
      if (!target) { nextOffset += direction * 30; if (nextOffset < 0 || nextOffset >= current.total) return;
        const next = current.boundaries?.[direction] || await admin.getQueue(filter, nextOffset);
        target = direction > 0 ? next.items[0] : next.items.at(-1);
        contextQueue.current = { ...next, total: current.total, offset: nextOffset, key: `${filter}:${nextOffset}` };
      }
      if (target) { setDirty(false); setError(''); setMessage(''); navigate(detailUrl(target.id, nextOffset)); }
    } catch (e) { setError(e.message); } finally { setAdjacentBusy(false); }
  };
  useEffect(() => {
    if (!profile.is_admin) return;
    const controller = new AbortController();
    admin.getCounts(controller.signal).then(data => { if (!controller.signal.aborted) setCounts(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    admin.getFeedback(0, 'all', controller.signal).then(data => { if (!controller.signal.aborted) setFeedbackCounts(data.counts || { all: data.total }); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [profile.is_admin, version]);

  useEffect(() => {
    if (!profile.is_admin) return;
    const controller = new AbortController();
    setQueueLoading(true); setError(''); setQueue({ items: [], total: 0 });
    admin.getQueue(filter, offset, controller.signal).then(data => { if (!controller.signal.aborted) { setQueue(data); if (!selected || !contextQueue.current || contextQueue.current.key !== `${filter}:${offset}`) contextQueue.current = { ...data, offset, key: `${filter}:${offset}` }; } }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setQueueLoading(false); });
    return () => controller.abort();
  }, [profile.is_admin, filter, offset, version]);

  useEffect(() => {
    if (!profile.is_admin || !selected) return;
    const controller = new AbortController();
    setNotice(null); setDetailError(''); setSourcePanel('');
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
      // 상태 변경으로 목록에서 빠져도 페이지 경계의 다음 공지를 건너뛰지 않는다.
      const current = contextQueue.current;
      if (current && action !== 'save') {
        const index = current.items.findIndex(n => String(n.id) === String(selected));
        current.boundaries ||= {};
        for (const direction of [-1, 1]) {
          const nextOffset = current.offset + direction * 30;
          if ((direction < 0 ? index === 0 : index === current.items.length - 1) && nextOffset >= 0 && nextOffset < current.total && !current.boundaries[direction]) {
            current.boundaries[direction] = await admin.getQueue(filter, nextOffset);
          }
        }
      }
      const result = await admin.reviewNotice(notice.id, { revision: notice.revision, action, reason, events: action === 'reject' ? [] : events });
      setDirty(false); setMessage(`검수 결과를 저장했어요.${result.resolved_reports ? ` 신고 ${result.resolved_reports}건을 처리했어요.` : ''}`); setVersion((v) => v + 1); await refresh();
    } catch (e) { setError(e.status === 409 ? '다른 작업에서 수정되었어요. 입력 내용은 유지했어요. 새로 불러온 뒤 다시 검수해 주세요.' : e.message); }
    finally { saving.current = false; setBusy(false); }
  };

  if (status === 'loading') return <p role="status">권한을 확인하고 있어요…</p>;
  if (!profile.is_admin) return <p role="alert">관리자 계정으로 로그인해 주세요.</p>;
  const safeUrl = notice && /^https?:\/\//i.test(notice.source_url) ? notice.source_url : null;
  const currentQueue = contextQueue.current || { ...queue, offset };
  const selectedIndex = currentQueue.items.findIndex(n => String(n.id) === String(selected));
  const position = selectedIndex < 0 ? 0 : currentQueue.offset + selectedIndex + 1;
  const openReports = notice?.reports?.filter(r => !r.resolved_at).length || 0;
  const excerpts = dateLines(notice?.body, events);
  return <div className={`admin-review ${selected ? 'admin-detail-open' : ''}`}>
    {!selected && <header className="admin-heading"><div><h1>관리자 검토</h1><p>{tab === 'feedback' ? '사용자가 보낸 의견이에요. 최신 순서로 보여요.' : '원문에서 접수와 본행사의 날짜·장소를 확인해 주세요.'}</p></div>
      <nav className="admin-tabs" aria-label="관리자 메뉴">{[['review', '일정 검수'], ['feedback', '서비스 의견']].map(([id, label]) => <button key={id} aria-pressed={tab === id} disabled={busy} onClick={() => go(id === 'review' ? listUrl() : '/admin/review?tab=feedback&type=all')}>{label}{tab !== id && <span> {id === 'review' ? (counts.needs_review || 0) + (counts.reported || 0) : feedbackCounts.all || 0}</span>}</button>)}</nav>
    </header>}
    {error && <p role="alert" className="admin-error">{error}{!notice && <button disabled={busy} onClick={() => setVersion(v => v + 1)}>다시 시도</button>}</p>}
    {message && <p role="status" className="admin-success">{message} <button className="admin-primary" disabled={!position || position >= currentQueue.total || busy || adjacentBusy} onClick={() => move(1)}>다음 공지</button></p>}
    {tab === 'feedback' ? <FeedbackList key={type} type={type} onType={id => go(`/admin/review?tab=feedback&type=${id}`)} onCounts={setFeedbackCounts} /> : !selected ? <section className="admin-queue">
      <nav className="admin-filters" aria-label="검수 상태">{Object.entries(states).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => go(listUrl(id, 0))}>{label} <span className={!counts[id] ? 'admin-zero' : ''}>{counts[id] ?? 0}</span></button>)}</nav>
      <div className="admin-list">{queueLoading ? <p role="status">공지 목록을 불러오고 있어요…</p> : !queue.items.length ? !error && <p>이 상태의 공지가 없어요.</p> : queue.items.map(n => <Link ref={node => { if (node) queueButtons.current.set(String(n.id), node); else queueButtons.current.delete(String(n.id)); }} className="admin-queue-item" key={n.id} to={detailUrl(n.id)}><strong>{n.title}</strong>{n.reason && <span className="admin-reason">{n.reason}</span>}<small>{sourceLabel(n.source)} <span className="admin-chip">{stateLabel(n.state)}</span> · 게시 {dateLabel(n.published_at)} {n.open_report_count > 0 && <span className="admin-report-badge">신고 {n.open_report_count}건</span>}</small></Link>)}</div>
      <div className="admin-pagination"><span>{queue.total}건 중 {queue.total ? offset + 1 : 0}~{Math.min(offset + queue.items.length, queue.total)}</span><button disabled={offset === 0 || queueLoading} onClick={() => go(listUrl(filter, Math.max(0, offset - 30)))}>이전</button><button disabled={offset + 30 >= queue.total || queueLoading} onClick={() => go(listUrl(filter, offset + 30))}>다음</button></div>
    </section> : <section className="admin-detail" aria-label="공지 검수 상세">
      <nav className="admin-detail-nav" aria-label="공지 이동"><button className="admin-back" ref={backButton} disabled={busy || adjacentBusy} onClick={leaveDetail}>← {states[filter]} 목록으로</button><div><button disabled={busy || adjacentBusy || position <= 1} onClick={() => move(-1)}>이전 공지</button><span>{position} / {currentQueue.total}</span><button disabled={busy || adjacentBusy || !position || position >= currentQueue.total} onClick={() => move(1)}>다음 공지</button></div></nav>
        {detailError && <p role="alert">{detailError}<button onClick={() => setVersion(v => v + 1)}>다시 시도</button></p>}
        {!notice ? <p>{detailError ? '상세를 불러오지 못했어요.' : '원문을 불러오고 있어요…'}</p> : <>
          <header className="admin-notice-heading"><div>{openReports > 0 && <span className="admin-report-badge">미처리 신고 {openReports}건</span>} <span className="admin-chip">{stateLabel(notice.state)}</span> <span>{sourceLabel(notice.source || currentQueue.items.find(n => String(n.id) === String(selected))?.source)} · 게시 {dateLabel(notice.published_at || currentQueue.items.find(n => String(n.id) === String(selected))?.published_at)}</span></div><h1>{notice.title}</h1></header>
          <div className="admin-source-controls">
            {safeUrl && <button aria-expanded={sourcePanel === 'link'} onClick={() => setSourcePanel(sourcePanel === 'link' ? '' : 'link')}>원문 열기</button>}
            <button aria-expanded={sourcePanel === 'body'} onClick={() => setSourcePanel(sourcePanel === 'body' ? '' : 'body')}>수집한 원문</button>
            <button aria-expanded={sourcePanel === 'model'} onClick={() => setSourcePanel(sourcePanel === 'model' ? '' : 'model')}>모델 출력 원본</button>
          </div>
          {sourcePanel === 'link' && <p><a href={safeUrl} target="_blank" rel="noreferrer">새 탭에서 원문 열기 ↗</a><br />{safeUrl}</p>}
          {sourcePanel === 'body' && <pre>{notice.body || '본문이 없어요. 원문 링크를 확인해 주세요.'}</pre>}
          {sourcePanel === 'model' && <pre>{JSON.stringify(notice.model_output, null, 2)}</pre>}
          {!!notice.reports?.length && <section className="admin-reports" aria-label="사용자 신고"><h3>사용자 신고 · {notice.reports.length}건</h3>{notice.reports.map(report => <article key={report.id} className={report.resolved_at ? 'admin-resolved' : ''}><strong>{REPORT_REASONS.find(([id]) => id === report.reason)?.[1] || '기타'} {report.resolved_at && '· 처리됨'}</strong><p>{report.memo || '추가 메모가 없어요.'}</p><small>접수 {dateLabel(report.created_at)}{report.resolved_at && ` · 처리 ${dateLabel(report.resolved_at)}`}</small></article>)}</section>}
          {notice.state === 'processing' && <p role="status">추출을 처리하고 있어요. 완료된 뒤 수정할 수 있어요.</p>}
          {notice.error && <p role="alert">추출 오류: {notice.error}</p>}
          <fieldset disabled={busy || notice.state === 'processing'}>
            <legend className="sr-only">일정 편집</legend>
            <div className="admin-editor-columns"><details className="admin-excerpts" open={!window.matchMedia('(max-width: 768px)').matches}><summary>원문에서 날짜가 나온 줄</summary>{excerpts.length ? excerpts.map(line => <p key={line.index}>{line.parts.map((part, i) => part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</p>) : <p>날짜 표기가 있는 줄이 없어요. 원문을 확인해 주세요.</p>}</details><div>
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
            </div></div><div className="admin-review-footer"><label>검수 사유 (필수)<textarea value={reason} onChange={(e) => { setReason(e.target.value); setDirty(true); }} /></label>
            <p>승인한 일정만 공개돼요. 날짜가 불명확하거나 취소된 일정은 새로 등록할 수 없어요.</p>
            <div className="admin-actions">
              <button onClick={() => submit('save')}>검토 중으로 저장</button>
              <button className="admin-danger" onClick={() => submit('reject')}>거절 · 공지 제외</button>
              <button className="admin-primary" onClick={() => submit('approve')}>{openReports ? '수정 승인 · 신고 처리' : '승인 및 공개'}</button>
            </div>
            </div></fieldset>
          <button disabled={busy} onClick={() => { if (discard()) { setDirty(false); setError(''); setVersion((v) => v + 1); } }}>새로 불러오기</button>
          <details><summary>검수 이력 ({(notice.history || []).length})</summary>{(notice.history || []).map((log) => <article key={log.id}><p>{log.at} · 관리자 #{log.actor_id} · {({ save: '저장', approve: '승인', reject: '거절' })[log.action] || '검수'}: {log.reason}</p><pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></article>)}</details>
        </>}
    </section>}
  </div>;
}
