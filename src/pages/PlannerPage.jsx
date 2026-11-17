import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AI_MODES } from '../config/aiModes';
import { getInterestCategory } from '../config/interestCategories';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import EventExpand from '../components/events/EventExpand';
import { ChevronIcon, ExternalLinkIcon } from '../components/icons';
import { getRecommendations } from '../services/plannerService';
import { LABEL_FIELDS, findPlannerEvent, actionDeadline, buildFocusGroups, scheduleLabel, slotLabel, plainTitle, eligibilityLabel, countPlannerLabels, plannerLabel, plannerSummary, plannerErrorMessage, recommendationTime, readPlannerCache, writePlannerCache, invalidatePlannerCache, plannerStorage, refreshFailureState, refreshLimitMessage, REFRESH_NOTICE_MS } from '../utils/planner';

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
// 실제 처리 단계가 아니라 시간에 따라 바뀌는 안내 문구다. 마지막 문구에서 멈춘다.
export const PLANNER_LOADING_STEPS = ['내 일정을 확인하고 있어요', '새 공지를 살펴보고 있어요', '마감과 지원 조건을 비교하고 있어요', '추천을 정리하고 있어요'];
const PLANNER_STEP_MS = 2500;
export function PlannerLoading() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= PLANNER_LOADING_STEPS.length - 1) return undefined;
    const timer = setTimeout(() => setStep((value) => value + 1), PLANNER_STEP_MS);
    return () => clearTimeout(timer);
  }, [step]);
  return <div className="planner-loading" aria-busy="true">
    {/* 화면 낭독기에는 고정 문구 한 번만 알리고, 바뀌는 단계 문구는 화면에만 보인다. */}
    <p role="status" className="sr-only">AI 추천을 준비하고 있어요. 처음 추천은 시간이 조금 걸려요.</p>
    <div className="planner-progress" aria-hidden="true">
      <p className="planner-step" key={step}>{PLANNER_LOADING_STEPS[step]}…</p>
      <div className="planner-bar"><span /></div>
      <p className="planner-hint">처음 추천은 시간이 조금 걸려요.</p>
    </div>
    {[1, 2, 3].map((key) => <div key={key} className="planner-placeholder" aria-hidden="true"><span /><span /><span /></div>)}
  </div>;
}
export function PlannerRefresh({ loading, notice, onRefresh }) {
  return <><button type="button" className="planner-refresh" disabled={loading || Boolean(notice)} onClick={onRefresh}>새로 받기</button>{notice && <span className="planner-limit" role="status">{notice}</span>}</>;
}
export function PlannerError({ error, onRetry }) {
  return <div className="planner-error" role="alert"><p>{plannerErrorMessage(error)}</p><button type="button" onClick={onRetry}>다시 시도</button></div>;
}
function ddayText(days) {
  if (!Number.isFinite(days)) return '—';
  return days < 0 ? `D+${Math.abs(days)}` : days === 0 ? 'D-day' : `D-${days}`;
}
// 시간 겹침의 일시는 서버가 준 '실제로 겹치는 일정'(conflict_times)을 쓴다. 고른 것은 첫 상대와의 겹침 기준.
const overlapLabel = (item, group) => {
  const other = item === group.chosen ? group.others[0] : group.chosen;
  return slotLabel(item.conflict_times?.[other?.opportunity_id]) || scheduleLabel(item);
};
const FOCUS_ROWS = {
  time: [['일시', overlapLabel], ['얻는 것', (item) => item.benefit || '—'], ['자격', (item) => eligibilityLabel(item.eligibility)]],
  similar: [['마감', (item) => ddayText(item.days_until_deadline)], ['얻는 것', (item) => item.benefit || '—'], ['자격', (item) => eligibilityLabel(item.eligibility)]],
};
/** 집중할 것 비교표 (목록 줄을 펼쳤을 때): 열 = 일정(고른 것 먼저), 행 = 비교 기준. 일정 이름을 누르면 아래에 상세. */
function FocusTable({ group, events }) {
  const [open, setOpen] = useState(null);
  // 표는 고른 것 + 최대 3개까지. 넘치는 일정은 표 아래에 이름만 보여준다.
  const members = [group.chosen, ...group.others.slice(0, 3)];
  const extra = group.others.slice(3);
  const openItem = members.find((item) => item.opportunity_id === open);
  const event = openItem && findPlannerEvent(openItem, events);
  return <div className="focus-expand">
    <div className="focus-table-wrap"><table className="focus-table" style={{ '--focus-cols': members.length }}>
      <thead><tr><td aria-hidden="true" />{members.map((item, index) => <th scope="col" key={item.opportunity_id} className={index === 0 ? 'pick' : ''}>
        <button type="button" aria-expanded={open === item.opportunity_id} onClick={() => setOpen(open === item.opportunity_id ? null : item.opportunity_id)}>
          {index === 0 && <span aria-hidden="true">✓ </span>}{index === 0 && <span className="sr-only">집중: </span>}{plainTitle(item.title)}</button></th>)}</tr></thead>
      <tbody>{FOCUS_ROWS[group.kind].map(([label, value]) => <tr key={label}><th scope="row">{label}</th>
        {members.map((item, index) => <td key={item.opportunity_id} className={index === 0 ? 'pick' : ''}><span className="focus-cell">{value(item, group)}</span></td>)}</tr>)}</tbody>
    </table></div>
    {extra.length > 0 && <p className="focus-more">함께 미룬 일정: {extra.map((item) => plainTitle(item.title)).join(' · ')}</p>}
    {openItem && <div className="focus-detail">{event ? <EventExpand event={event} /> : <div className="planner-source">{openItem.source_url ? <a href={openItem.source_url} target="_blank" rel="noreferrer">원문 보기 <ExternalLinkIcon /></a> : <p>원문 링크가 없어요.</p>}</div>}</div>}
  </div>;
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
    const event = findPlannerEvent(item, events);
    const label = mode === 'focus' ? '' : plannerLabel(mode, item[field]);
    const secondary = '';
    const days = item.days_until_deadline;
    const deadline = mode === 'priority' ? actionDeadline(item, event) : '';
    return <div className={`planner-item ${expanded ? 'is-open' : ''}`} key={id}>
      <button type="button" className={`planner-rec ${mode === 'priority' ? 'has-rank' : ''}`} onClick={() => setOpen(expanded ? null : id)} aria-expanded={expanded} aria-controls={`planner-detail-${index}`}>
        {mode === 'priority' && <span className="planner-rank">{index + 1}</span>}
        <span className="planner-rec-body"><span className="planner-rec-title"><strong>{item.title}</strong>{label && <span className="planner-badge">{label}</span>}{secondary && <span className="planner-badge grey">{secondary}</span>}{Number.isFinite(days) && <span className={`planner-dday ${days <= 7 ? 'hot' : ''}`}>{days < 0 ? `D+${Math.abs(days)}` : days === 0 ? 'D-day' : `D-${days}`}</span>}</span>
          {mode === 'priority' && item.next_action && <span className="planner-next">
            <span className="planner-next-arrow" aria-hidden="true">→</span>
            <span><span className="sr-only">다음 행동: </span>{item.next_action}{deadline && <span className="planner-deadline">{deadline}</span>}</span>
          </span>}
          <span className={`planner-why ${mode === 'priority' ? 'is-sub' : ''}`}>{item.reason}</span>
          {mode === 'discover' && item.check_reasons?.length > 0 && <span className="planner-why planner-check">확인할 조건: {item.check_reasons.map((reason) => String(reason).replace(/[.\s]+$/, '')).join(' · ')}</span>}
        </span><span className={`planner-chevron ${expanded ? 'is-open' : ''}`}><ChevronIcon /></span>
      </button>
      {expanded && <div id={`planner-detail-${index}`}>{event ? <EventExpand event={event} /> : <div className="planner-source">{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">원문 보기 <ExternalLinkIcon /></a> : <p>원문 링크가 없어요.</p>}</div>}</div>}
    </div>;
  };
  const groupingFold = grouping.length > 0 && <><button type="button" className="planner-fold" aria-expanded={groupOpen} aria-controls="planner-grouping" onClick={() => setGroupOpen(!groupOpen)}><span className={`planner-chevron ${groupOpen ? 'is-open' : ''}`}><ChevronIcon /></span>원문에서 일정 구성을 확인할 공지 {grouping.length}건</button>{groupOpen && <div id="planner-grouping">{grouping.map((item, index) => <div className="planner-group-item" key={item.opportunity_id ?? index}><strong>{item.title}</strong>{item.reason && <p>{item.reason}</p>}</div>)}</div>}</>;
  if (mode === 'focus' && items.length) {
    // 집중할 것: 겹치거나 비슷한 일정 묶음마다 비교표, 비교 상대가 없는 일정은 한 줄 안내 뒤로
    const { groups, rest } = buildFocusGroups(items, data.comparison_groups);
    const restOpen = minorOpen || !groups.length;
    return <>
      <section className="planner-summary" aria-label="추천 요약"><p>{groups.length ? <>겹치거나 비슷한 일정 <strong>{groups.length}묶음</strong>을 비교했어요.</> : '지금은 겹치거나 비슷한 일정이 없어요.'}</p></section>
      <section className="planner-list" aria-label="비교 묶음">
      {groups.map((group) => {
        const key = `group-${group.chosen.opportunity_id}`;
        const expanded = open === key;
        const days = group.chosen.days_until_deadline;
        const others = group.others.map((item) => plainTitle(item.title));
        return <div className={`planner-item ${expanded ? 'is-open' : ''}`} key={key}>
          <button type="button" className="planner-rec" aria-expanded={expanded} aria-controls={`${key}-table`} onClick={() => setOpen(expanded ? null : key)}>
            <span className="planner-rec-body"><span className="planner-rec-title"><strong>{plainTitle(group.chosen.title)}</strong>
              <span className="planner-badge">{group.kind === 'time' ? '시간 겹침' : '비슷한 활동'}</span>
              {Number.isFinite(days) && <span className={`planner-dday ${days <= 7 ? 'hot' : ''}`}>{ddayText(days)}</span>}</span>
              <span className="planner-why">{group.chosen.reason}</span>
              <span className="planner-why is-sub">대신 미뤄요: {others.length > 2 ? `${others[0]} 외 ${others.length - 1}개` : others.join(' · ')}</span>
            </span><span className={`planner-chevron ${expanded ? 'is-open' : ''}`}><ChevronIcon /></span>
          </button>
          {expanded && <div id={`${key}-table`}><FocusTable group={group} events={events} /></div>}
        </div>;
      })}
        {rest.length > 0 && groups.length > 0 && <button type="button" className="planner-fold" aria-expanded={minorOpen} aria-controls="planner-minor" onClick={() => setMinorOpen(!minorOpen)}><span className={`planner-chevron ${minorOpen ? 'is-open' : ''}`}><ChevronIcon /></span>겹치거나 비슷한 일정이 없는 {rest.length}건</button>}
        {rest.length > 0 && restOpen && <div id="planner-minor">{rest.map(renderItem)}</div>}
      </section>
    </>;
  }
  return <>
    <section className="planner-summary" aria-label="추천 요약"><SummarySentence mode={mode} data={data} /><div className="planner-counts">{countPlannerLabels(mode, items).filter(({ value, count }) => count > 0 && !(mode === 'discover' && value === minorValue)).map(({ value, label, count }) => <span key={value}>{label} <b>{count}</b></span>)}</div></section>
    {!items.length && <div className="planner-empty"><p>추천할 공지가 아직 없어요. 전체 공지에서 관심 저장이나 일정 등록을 해 보세요.</p><Link to="/schedules">전체 공지 보기</Link></div>}
    {(items.length > 0 || grouping.length > 0) && <section className="planner-list" aria-label="추천 목록">
      {main.map(renderItem)}
      {minor.length > 0 && mode === 'discover' && <>
        <div className="planner-excluded"><span className="planner-excluded-mark" aria-hidden="true">ⓘ</span><span>지역·대상 조건이 맞지 않는 공지 {minor.length}건은 추천에서 뺐어요</span>
          <button type="button" aria-expanded={minorOpen} aria-controls="planner-minor" onClick={() => { setMinorOpen(!minorOpen); setOpen(null); }}>{minorOpen ? '접기' : '보기'}</button></div>
        {minorOpen && <div id="planner-minor" className="planner-muted">{minor.map(renderItem)}</div>}
      </>}
      {minor.length > 0 && mode !== 'discover' && <><button type="button" className="planner-fold" aria-expanded={minorOpen} aria-controls="planner-minor" onClick={() => { setMinorOpen(!minorOpen); setOpen(null); }}><span className={`planner-chevron ${minorOpen ? 'is-open' : ''}`}><ChevronIcon /></span>{plannerLabel(mode, minorValue)} {minor.length}건</button>{minorOpen && <div id="planner-minor">{minor.map(renderItem)}</div>}</>}
      {groupingFold}
    </section>}
  </>;
}

const enrollmentLabels = { enrolled: '재학', expected_graduation: '졸업 예정', leave: '휴학', graduated: '졸업' };
export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = AI_MODES.some((entry) => entry.id === params.get('mode')) ? params.get('mode') : null;
  const { events, calendarEvents, plannerEventKey, actionBusy, status: dataStatus, error: dataError, refresh: refreshData } = useAppData();
  const { profile, preferences, status: userStatus, plannerUserKey, plannerPending, sessionVersion } = useUser();
  const scope = profile.email;
  const inputKey = plannerUserKey != null && plannerEventKey != null ? JSON.stringify([plannerUserKey, plannerEventKey]) : null;
  const requestKey = JSON.stringify([scope, sessionVersion, inputKey]);
  const ready = Boolean(scope && userStatus === 'ready' && inputKey);
  const [state, setState] = useState(() => ({ mode, key: requestKey, data: mode && ready ? readPlannerCache(plannerStorage(), mode, scope, Date.now(), inputKey) : null, status: 'idle' }));
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
  const pending = useRef(false);
  // commit 후 passive effect 정리 전 도착하는 이전 응답도 차단한다.
  useLayoutEffect(() => { ++requestId.current; }, [mode, requestKey, ready]);
  useLayoutEffect(() => { pending.current = plannerPending || actionBusy; });
  useLayoutEffect(() => {
    force.current = false;
    lastResult.current = null;
    setLimitNotice(null);
  }, [requestKey]);
  useEffect(() => {
    const id = ++requestId.current;
    if (!mode || !ready) return;
    const storage = plannerStorage();
    invalidatePlannerCache(storage, scope, inputKey);
    const refreshRequest = force.current;
    const previousData = lastResult.current?.mode === mode ? lastResult.current.data : readPlannerCache(storage, mode, scope, Date.now(), inputKey);
    const cached = refreshRequest ? null : readPlannerCache(storage, mode, scope, Date.now(), inputKey);
    force.current = false;
    if (cached) { lastResult.current = { mode, data: cached }; setState({ mode, key: requestKey, status: 'ready', data: cached }); return; }
    const controller = new AbortController();
    let timer;
    setState({ mode, key: requestKey, status: 'loading', data: null });
    const request = () => {
      if (id !== requestId.current || controller.signal.aborted) return;
      // 저장 큐와 연속 변경이 끝난 입력만 요청한다. StrictMode의 첫 setup도 정리된다.
      if (pending.current) { timer = setTimeout(request, 150); return; }
      getRecommendations(mode, { signal: controller.signal, refresh: refreshRequest }).then((data) => {
        if (id !== requestId.current || controller.signal.aborted) return;
        if (data?.mode !== mode || !Array.isArray(data.items)) throw new Error('잘못된 추천 응답');
        writePlannerCache(storage, mode, scope, data, inputKey);
        lastResult.current = { mode, data };
        setState({ mode, key: requestKey, status: 'ready', data });
      }).catch((error) => {
        if (id !== requestId.current || controller.signal.aborted) return;
        if (error.status === 401) { navigate('/', { replace: true }); return; }
        if (error.status === 429) setLimitNotice({ mode, message: refreshLimitMessage(error) });
        setState({ ...refreshFailureState(mode, previousData, error), key: requestKey });
      });
    };
    timer = setTimeout(request, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, scope, inputKey, requestKey, ready, refresh, navigate]);
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
  const current = ready && state.mode === mode && state.key === requestKey ? state
    : userStatus === 'ready' && scope && dataStatus === 'error' && plannerEventKey == null
      ? { status: 'error', error: dataError, inputError: true } : { status: 'loading' };
  return <div className="planner-page">
    {!mode ? <>
      <header className="planner-intro"><h1>어떤 도움이 필요한가요?</h1><p>내 일정과 프로필을 보고 정리해 드려요.</p></header>
      <div className="planner-input-info"><span>추천에 쓰는 정보: 내 일정 {mine}건 · 새 공지 {fresh}건 · {profileText} · 관심분야 {interests}</span><Link to="/settings">설정에서 바꾸기</Link></div>
      <div className="planner-modes">{AI_MODES.map((entry) => <button type="button" key={entry.id} className="planner-mode" onClick={() => choose(entry.id)}><strong>{entry.name}</strong><span className="planner-question">{entry.question}</span><ul>{entry.criteria.map((line) => <li key={line}>{line}</li>)}</ul><span className="planner-mode-labels">{entry.labels.map((label) => <span className="planner-badge" key={label}>{label}</span>)}</span><span className="planner-go">추천 받기 <Arrow /></span></button>)}</div>
      <p className="planner-fine">날짜와 지원 조건은 NotiAI가 공지에서 직접 정리하고, AI는 그 내용만 보고 판단해요. 처음 추천은 시간이 조금 걸리고, 받은 추천은 30분 동안 저장돼요.</p>
    </> : <>
      <div className="planner-toolbar"><div className="planner-segment" aria-label="추천 모드">{AI_MODES.map((entry) => <button type="button" key={entry.id} aria-pressed={mode === entry.id} onClick={() => choose(entry.id)}>{entry.name}</button>)}</div><span className="planner-time">{current.data && recommendationTime(current.data.generated_at)}</span><PlannerRefresh loading={current.status === 'loading'} notice={limitNotice?.mode === mode ? limitNotice.message : ''} onRefresh={reload} /></div>
      {current.status === 'error' ? <PlannerError error={current.error} onRetry={() => { if (current.inputError) { refreshData(); return; } force.current = false; setRefresh(value => value + 1); }} /> : current.data ? <PlannerResults key={`${mode}:${current.data.generated_at}`} mode={mode} data={current.data} events={combined} /> : <PlannerLoading />}
    </>}
  </div>;
}
