import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AI_MODES } from '../config/aiModes';
import { getInterestCategory } from '../config/interestCategories';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import EventExpand from '../components/events/EventExpand';
import { ChevronIcon, ExternalLinkIcon } from '../components/icons';
import { getRecommendations } from '../services/plannerService';
import { LABEL_FIELDS, countPlannerLabels, plannerLabel, secondaryLabel, plannerSummary, plannerErrorMessage, recommendationTime, readPlannerCache, writePlannerCache, plannerStorage, refreshFailureState, refreshLimitMessage, REFRESH_NOTICE_MS } from '../utils/planner';

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function SummarySentence({ mode, data }) {
  const sentence = plannerSummary(mode, data);
  const title = mode === 'priority' ? data.items?.[0]?.title : null;
  return <p>{sentence.split(/(\d+건)/g).map((part, index) => {
    if (/^\d+건$/.test(part)) return <strong key={index}>{part}</strong>;
    if (title && part.includes(title)) {
      const at = part.indexOf(title);
      return <span key={index}>{part.slice(0, at)}<strong>{title}</strong>{part.slice(at + title.length)}</span>;
    }
    return part;
  })}</p>;
}
export function PlannerLoading() {
  return <div className="planner-loading" aria-busy="true"><p role="status">공지를 살펴보고 있어요. 20초쯤 걸려요.</p>{[1, 2, 3].map((key) => <div key={key} className="planner-placeholder" aria-hidden="true"><span /><span /><span /></div>)}</div>;
}
export function PlannerRefresh({ loading, notice, onRefresh }) {
  return <><button type="button" className="planner-refresh" disabled={loading || Boolean(notice)} onClick={onRefresh}>새로 받기</button>{notice && <span className="planner-limit" role="status">{notice}</span>}</>;
}
export function PlannerError({ error, onRetry }) {
  return <div className="planner-error" role="alert"><p>{plannerErrorMessage(error)}</p><button type="button" onClick={onRetry}>다시 시도</button></div>;
}
export function PlannerResults({ mode, data, events }) {
  const [open, setOpen] = useState(null);
  const [minorOpen, setMinorOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const items = data.items ?? [];
  const minorValue = mode === 'discover' ? 'not_recommended' : mode === 'focus' ? 'secondary' : null;
  const field = LABEL_FIELDS[mode];
  const main = items.filter((item) => !minorValue || item[field] !== minorValue);
  const minor = items.filter((item) => minorValue && item[field] === minorValue);
  const grouping = data.needs_grouping_check ?? [];
  const renderItem = (item) => {
    const index = items.indexOf(item);
    const id = `${item.opportunity_id ?? 'item'}-${index}`;
    const expanded = open === id;
    const event = events.find((entry) => String(entry.id) === String(item.focus_event_id));
    const label = plannerLabel(mode, item[field]);
    const secondary = mode === 'focus' && item.tier === 'secondary' ? secondaryLabel(item.secondary_reason) : '';
    const days = item.days_until_deadline;
    return <div className={`planner-item ${expanded ? 'is-open' : ''}`} key={id}>
      <button type="button" className={`planner-rec ${mode === 'priority' ? 'has-rank' : ''}`} onClick={() => setOpen(expanded ? null : id)} aria-expanded={expanded} aria-controls={`planner-detail-${index}`}>
        {mode === 'priority' && <span className="planner-rank">{index + 1}</span>}
        <span className="planner-rec-body"><span className="planner-rec-title"><strong>{item.title}</strong>{label && <span className="planner-badge">{label}</span>}{secondary && <span className="planner-badge grey">{secondary}</span>}{Number.isFinite(days) && <span className={`planner-dday ${days <= 7 ? 'hot' : ''}`}>{days < 0 ? `D+${Math.abs(days)}` : days === 0 ? 'D-day' : `D-${days}`}</span>}</span>
          <span className="planner-why">{item.reason}</span>
          {mode === 'priority' && item.next_action && <span className="planner-next"><b>다음 행동</b> {item.next_action}</span>}
          {mode === 'discover' && item.check_reasons?.length > 0 && <span className="planner-why">확인할 조건: {item.check_reasons.join(', ')}</span>}
        </span><span className={`planner-chevron ${expanded ? 'is-open' : ''}`}><ChevronIcon /></span>
      </button>
      {expanded && <div id={`planner-detail-${index}`}>{event ? <EventExpand event={event} /> : <div className="planner-source">{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">원문 보기 <ExternalLinkIcon /></a> : <p>원문 링크가 없어요.</p>}</div>}</div>}
    </div>;
  };
  return <>
    <section className="planner-summary" aria-label="추천 요약"><SummarySentence mode={mode} data={data} /><div className="planner-counts">{countPlannerLabels(mode, items).map(({ value, label, count }) => <span key={value}>{label} <b>{count}</b></span>)}</div></section>
    {!items.length && <div className="planner-empty"><p>추천할 공지가 아직 없어요. 전체 공지에서 관심 저장이나 일정 등록을 해 보세요.</p><Link to="/schedules">전체 공지 보기</Link></div>}
    {(items.length > 0 || grouping.length > 0) && <section className="planner-list" aria-label="추천 목록">
      {main.map(renderItem)}
      {minor.length > 0 && <><button type="button" className="planner-fold" aria-expanded={minorOpen} aria-controls="planner-minor" onClick={() => { setMinorOpen(!minorOpen); setOpen(null); }}><span className={`planner-chevron ${minorOpen ? 'is-open' : ''}`}><ChevronIcon /></span>{plannerLabel(mode, minorValue)} {minor.length}건</button>{minorOpen && <div id="planner-minor">{minor.map(renderItem)}</div>}</>}
      {grouping.length > 0 && <><button type="button" className="planner-fold" aria-expanded={groupOpen} aria-controls="planner-grouping" onClick={() => setGroupOpen(!groupOpen)}><span className={`planner-chevron ${groupOpen ? 'is-open' : ''}`}><ChevronIcon /></span>같은 공지인지 확인이 필요한 항목 {grouping.length}건</button>{groupOpen && <div id="planner-grouping">{grouping.map((item, index) => <div className="planner-group-item" key={item.opportunity_id ?? index}><strong>{item.title}</strong>{item.reason && <p>{item.reason}</p>}</div>)}</div>}</>}
    </section>}
  </>;
}

const enrollmentLabels = { enrolled: '재학', expected_graduation: '졸업 예정', leave: '휴학', graduated: '졸업' };
export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = AI_MODES.some((entry) => entry.id === params.get('mode')) ? params.get('mode') : null;
  const { events, calendarEvents } = useAppData();
  const { profile, preferences, status: userStatus } = useUser();
  const scope = profile.email || 'session';
  const [state, setState] = useState(() => ({ mode, data: mode ? readPlannerCache(plannerStorage(), mode, scope) : null, status: 'idle' }));
  const [refresh, setRefresh] = useState(0);
  const force = useRef(false);
  const lastResult = useRef(null);
  const [limitNotice, setLimitNotice] = useState(null);
  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(null), REFRESH_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [limitNotice]);
  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    if (!mode || userStatus === 'loading') return;
    const storage = plannerStorage();
    const refreshRequest = force.current;
    const previousData = lastResult.current?.mode === mode ? lastResult.current.data : readPlannerCache(storage, mode, scope);
    const cached = refreshRequest ? null : readPlannerCache(storage, mode, scope);
    force.current = false;
    if (cached) { lastResult.current = { mode, data: cached }; setState({ mode, status: 'ready', data: cached }); return; }
    const controller = new AbortController();
    setState({ mode, status: 'loading', data: null });
    getRecommendations(mode, { signal: controller.signal, refresh: refreshRequest }).then((data) => {
      if (id !== requestId.current || controller.signal.aborted) return;
      if (data?.mode !== mode || !Array.isArray(data.items)) throw new Error('잘못된 추천 응답');
      writePlannerCache(storage, mode, scope, data);
      lastResult.current = { mode, data };
      setState({ mode, status: 'ready', data });
    }).catch((error) => {
      if (id !== requestId.current || controller.signal.aborted) return;
      if (error.status === 401) { navigate('/', { replace: true }); return; }
      if (error.status === 429) setLimitNotice({ mode, message: refreshLimitMessage(error) });
      setState(refreshFailureState(mode, previousData, error));
    });
    return () => controller.abort();
  }, [mode, scope, userStatus, refresh, navigate]);
  const choose = (next) => {
    if (next === mode) return;
    force.current = false;
    setParams((current) => { const copy = new URLSearchParams(current); copy.set('mode', next); return copy; });
  };
  const reload = () => { force.current = true; setRefresh((value) => value + 1); };
  const combined = [...calendarEvents, ...events];
  const mine = new Set(combined.filter((event) => !event.dismissed && (event.registered || event.bookmarked)).map((event) => String(event.id))).size;
  const fresh = events.filter((event) => !event.dismissed && event.is_new).length;
  const profileText = [profile.major, profile.grade ? `${profile.grade}학년` : '', enrollmentLabels[profile.enrollment_status]].filter(Boolean).join(' · ') || '프로필 없음';
  const interests = (preferences.interests ?? []).map((id) => getInterestCategory(id)?.label).filter(Boolean).join(', ') || '선택 안 함';
  const current = state.mode === mode ? state : { status: 'loading' };
  return <div className="planner-page">
    {!mode ? <>
      <header className="planner-intro"><h1>어떤 도움이 필요한가요?</h1><p>내 일정과 프로필을 보고 정리해 드려요.</p></header>
      <div className="planner-input-info"><span>추천에 쓰는 정보: 내 일정 {mine}건 · 새 공지 {fresh}건 · {profileText} · 관심분야 {interests}</span><Link to="/settings">설정에서 바꾸기</Link></div>
      <div className="planner-modes">{AI_MODES.map((entry) => <button type="button" key={entry.id} className="planner-mode" onClick={() => choose(entry.id)}><strong>{entry.name}</strong><span className="planner-question">{entry.question}</span><ul>{entry.criteria.map((line) => <li key={line}>{line}</li>)}</ul><span className="planner-mode-labels">{entry.labels.map((label) => <span className="planner-badge" key={label}>{label}</span>)}</span><span className="planner-go">추천 받기 <Arrow /></span></button>)}</div>
      <p className="planner-fine">날짜와 지원 조건은 NotiAI가 공지에서 직접 정리하고, AI는 그 내용만 보고 판단해요. 처음 추천은 20초쯤 걸리고 30분 동안 저장돼요.</p>
    </> : <>
      <div className="planner-toolbar"><div className="planner-segment" aria-label="추천 모드">{AI_MODES.map((entry) => <button type="button" key={entry.id} aria-pressed={mode === entry.id} onClick={() => choose(entry.id)}>{entry.name}</button>)}</div><span className="planner-time">{current.data && recommendationTime(current.data.generated_at)}</span><PlannerRefresh loading={current.status === 'loading'} notice={limitNotice?.mode === mode ? limitNotice.message : ''} onRefresh={reload} /></div>
      {current.status === 'error' ? <PlannerError error={current.error} onRetry={() => { force.current = false; setRefresh(value => value + 1); }} /> : current.data ? <PlannerResults key={`${mode}:${current.data.generated_at}`} mode={mode} data={current.data} events={combined} /> : <PlannerLoading />}
    </>}
  </div>;
}
