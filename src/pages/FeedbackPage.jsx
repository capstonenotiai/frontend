import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadError from '../components/LoadError';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { getEventDetail, reportEvent } from '../services/eventService';
import { sendFeedback } from '../services/feedbackService';
import { formatScheduleWhen } from '../utils/scheduleWhen';
import { TYPE_LABELS } from '../utils/eventLabels';
import { REPORT_REASONS, FEEDBACK_TYPES } from '../utils/settings';
import { getInterestCategory } from '../config/interestCategories';
import { getSource } from '../config/sources';

function Radios({ name, legend, options, value, onChange, disabled }) {
  return <fieldset className="feedback-field" disabled={disabled}><legend>{legend}</legend><div className="feedback-reasons">{options.map(([id, label]) => <label key={id}><input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />{label}</label>)}</div></fieldset>;
}
function Category({ event }) {
  const category = getInterestCategory(event.category);
  return <span className="feedback-category"><i aria-hidden="true" style={{ background: category ? `var(--cat-${category.id})` : 'var(--color-muted)' }} />{category?.label || '기타'}</span>;
}
function ReportForm({ onSuccess }) {
  const { events, hiddenEvents = [], status, refresh } = useAppData();
  const [query, setQuery] = useState(''), [picked, setPicked] = useState(null);
  const [detail, setDetail] = useState([]), [detailStatus, setDetailStatus] = useState('idle');
  const [eventId, setEventId] = useState(''), [reason, setReason] = useState('date'), [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0), lock = useRef(false), searchRef = useRef(null);
  const scheduleRef = useRef(null), focusNext = useRef(false);
  useEffect(() => {
    if (!focusNext.current) return;
    if (!picked) { searchRef.current?.focus(); focusNext.current = false; }
    else if (detailStatus === 'ready') { scheduleRef.current?.focus(); focusNext.current = false; }
  }, [picked, detailStatus]);
  useEffect(() => {
    const version = ++request.current;
    if (!picked) { setDetail([]); setDetailStatus('idle'); setEventId(''); return; }
    setDetailStatus('loading'); setDetail([]); setEventId('');
    getEventDetail(picked.id).then(data => {
      if (request.current !== version) return;
      setDetail(data.events); setEventId(data.events[0]?.id || ''); setDetailStatus('ready');
    }).catch(() => { if (request.current === version) setDetailStatus('error'); });
    return () => { ++request.current; };
  }, [picked, attempt]);
  const term = query.trim().toLocaleLowerCase();
  const seen = new Set();
  const results = term ? [...events, ...hiddenEvents].filter(event => {
    const key = event.notice_id ?? event.id;
    if (!event.title.toLocaleLowerCase().includes(term) || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 5) : [];
  const ready = detailStatus === 'ready' && Boolean(eventId);
  const reset = () => { focusNext.current = true; setPicked(null); setQuery(''); setEventId(''); setReason('date'); setMemo(''); setError(''); };
  return <form className="feedback-form" onSubmit={async event => {
    event.preventDefault(); if (!ready || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await reportEvent(eventId, reason, memo); reset(); onSuccess('신고를 보냈어요. 확인 후 고칠게요.'); }
    catch (err) { setError(err.message || '신고를 보내지 못했어요. 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  }}>
    <section className="feedback-step"><span className="feedback-step-number" aria-hidden="true">1</span><div className="feedback-step-body"><h2>공지 고르기</h2>
      {picked ? <div className="feedback-picked"><div><Category event={picked} /><strong>{picked.title}</strong><small>{getSource(picked.source).label} · {formatScheduleWhen(picked)}</small></div><button type="button" className="settings-button quiet" disabled={busy} onClick={() => { focusNext.current = true; setPicked(null); setReason('date'); setMemo(''); setError(''); }}>바꾸기</button></div>
        : <><input ref={searchRef} className="settings-input" aria-label="신고할 공지 찾기" placeholder="공지 제목으로 찾기" value={query} disabled={busy || status === 'loading'} onChange={event => setQuery(event.target.value)} />
          {status === 'loading' && <p role="status">공지를 불러오는 중…</p>}
          {status === 'error' ? <LoadError onRetry={refresh} /> : <div className="feedback-results">{results.map(event => <button type="button" key={event.id} onClick={() => { focusNext.current = true; setPicked(event); setError(''); }}><Category event={event} /><span>{event.title}</span><small>{formatScheduleWhen(event)}</small></button>)}{term && status === 'ready' && !results.length && <p>찾는 공지가 없어요.</p>}</div>}</>}
    </div></section>
    <section className={`feedback-step ${ready ? '' : 'is-disabled'}`}><span className="feedback-step-number" aria-hidden="true">2</span><div className="feedback-step-body"><h2>무엇이 틀렸나요</h2>
      {detailStatus === 'loading' && <p role="status">일정을 불러오는 중…</p>}
      {detailStatus === 'error' && <LoadError message="일정을 불러오지 못했어요." onRetry={() => setAttempt(value => value + 1)} />}
      {detailStatus === 'ready' && !detail.length && <p>신고할 일정이 없어요. 다른 공지를 골라 주세요.</p>}
      <label className="feedback-field">어떤 일정이 틀렸나요<select ref={scheduleRef} className="settings-input" value={eventId} disabled={!ready || busy} onChange={event => setEventId(event.target.value)}>{!detail.length && <option value="">공지를 먼저 골라 주세요</option>}{detail.map(item => <option key={item.id} value={item.id}>{TYPE_LABELS[item.event_type] ?? '일정'} ({formatScheduleWhen(item)})</option>)}</select></label>
      <Radios name="report-reason" legend="이유" options={REPORT_REASONS} value={reason} onChange={setReason} disabled={!ready || busy} />
      <label className="feedback-field">메모 (선택)<textarea className="feedback-textarea" aria-label="메모" maxLength={2000} placeholder="공지에 적힌 내용을 알려 주시면 빨리 고칠 수 있어요 (선택)" value={memo} disabled={!ready || busy} onChange={event => setMemo(event.target.value)} /><span className="feedback-count">{memo.length}/2000</span></label>
    </div></section>
    <section className={`feedback-step ${ready ? '' : 'is-disabled'}`}><span className="feedback-step-number" aria-hidden="true">3</span><div className="feedback-step-body"><h2>신고 보내기</h2><button className="settings-button primary" type="submit" disabled={!ready || busy}>{busy ? '보내는 중…' : '신고하기'}</button></div></section>
    {error && <p className="settings-error" role="alert">{error}</p>}
  </form>;
}
function OpinionForm({ onSuccess }) {
  const { profile } = useUser();
  const [type, setType] = useState('inconvenience'), [message, setMessage] = useState(''), [reply, setReply] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  return <form className="feedback-form" onSubmit={async event => {
    event.preventDefault(); if (lock.current || !message.trim()) return;
    lock.current = true; setBusy(true); setError('');
    try { await sendFeedback({ type, message, replyEmail: reply ? profile.email : undefined }); setType('inconvenience'); setMessage(''); setReply(true); onSuccess('의견을 보냈어요. 고마워요.'); }
    catch (err) { setError(err.message || '의견을 보내지 못했어요. 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  }}>
    <Radios name="feedback-type" legend="어떤 의견인가요" options={FEEDBACK_TYPES} value={type} onChange={setType} disabled={busy} />
    <label className="feedback-field">내용<textarea className="feedback-textarea opinion" aria-label="의견 내용" required maxLength={2000} placeholder="NotiAI를 쓰며 느낀 점을 자유롭게 적어 주세요" value={message} disabled={busy} aria-invalid={Boolean(error) || undefined} onChange={event => setMessage(event.target.value)} /><span className="feedback-count">{message.length}/2000</span></label>
    <label className="feedback-checkbox"><input type="checkbox" checked={reply} disabled={busy || !profile.email} onChange={event => setReply(event.target.checked)} />답변을 {profile.email}로 받을게요</label>
    <div><button type="submit" className="settings-button primary" disabled={busy || !message.trim()}>{busy ? '보내는 중…' : '의견 보내기'}</button></div>
    {error && <p className="settings-error" role="alert">{error}</p>}
  </form>;
}
export default function FeedbackPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'opinion' ? 'opinion' : 'report';
  const refs = useRef({}), [notice, setNotice] = useState('');
  useEffect(() => { if (!['report', 'opinion'].includes(params.get('tab'))) { const next = new URLSearchParams(params); next.set('tab', 'report'); setParams(next, { replace: true }); } }, [params, setParams]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  const select = (value, focus = false) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); setNotice(''); if (focus) refs.current[value]?.focus(); };
  return <div className="feedback-page"><div className="feedback-heading"><div role="tablist" aria-label="피드백 종류" className="settings-segments feedback-tabs">
    {[['report', '일정 신고'], ['opinion', '서비스 의견']].map(([id, label]) => <button key={id} ref={element => { refs.current[id] = element; }} type="button" id={`feedback-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`feedback-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => select(id)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); select(event.key === 'Home' ? 'report' : event.key === 'End' ? 'opinion' : tab === 'report' ? 'opinion' : 'report', true); } }}>{label}</button>)}
  </div><p>{tab === 'report' ? '잘못 추출된 일정을 알려 주시면 확인 후 고칠게요.' : '보내 주신 의견은 서비스 개선에 써요.'}</p></div>
    <div className="feedback-card" id={`feedback-panel-${tab}`} role="tabpanel" aria-labelledby={`feedback-tab-${tab}`}>
      {tab === 'report' ? <ReportForm onSuccess={setNotice} /> : <OpinionForm onSuccess={setNotice} />}
    </div><div className="feedback-notice" role="status" aria-live="polite">{notice}</div>
  </div>;
}
