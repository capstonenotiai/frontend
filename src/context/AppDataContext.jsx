import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as calendarService from '../services/calendarService';
import * as dashboardService from '../services/dashboardService';
import * as eventService from '../services/eventService';
import { enrichEvent } from '../utils/events';
import { getToday } from '../utils/date';
import RegisterConfirmDialog from '../components/RegisterConfirmDialog';
import UndoToast from '../components/UndoToast';
import { useUser } from './UserContext';
import { registrationTargets, needsConfirmation } from '../utils/registration';
import { plannerEventInputKey } from '../utils/planner';

/**
 * 일정 데이터 + 캘린더 등록 상태를 여러 화면(Dashboard / 일정 목록 / 캘린더 / 사이드바)이 공유.
 * 데이터 접근은 항상 services 를 통해서만 한다. (컴포넌트에서 fetch 금지)
 */
const AppDataContext = createContext(null);

export function AppDataProvider({ children, enabled = true }) {
  const { profile, preferences, sourcesVersion, plannerSourceKey } = useUser();
  const account = useRef(null);
  account.current = { scope: profile.email, sourcesKey: plannerSourceKey };
  const [plannerSnapshot, setPlannerSnapshot] = useState(null);
  const enabledSources = preferences.enabled_sources;
  const refreshVersion = useRef(0);
  const [events, setEvents] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [hiddenEvents, setHiddenEvents] = useState([]);
  const [registrationQueue, setRegistrationQueue] = useState([]);
  const registrationTrigger = useRef(null);
  const [actionBusy, setActionBusy] = useState(false);
  const actionLock = useRef(false);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [undoToast, setUndoToast] = useState(null);
  const showUndo = useCallback((message, undo) => setUndoToast({ message, undo }), []);
  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => setUndoToast(null), 5000);
    return () => clearTimeout(timer);
  }, [undoToast]);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const loadHidden = useCallback(async (version = refreshVersion.current) => {
    const items = await eventService.getEvents(true);
    if (version === refreshVersion.current) setHiddenEvents(items.filter((event) => event.dismissed));
    return items.filter((event) => event.dismissed);
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const version = ++refreshVersion.current;
    const inputAccount = account.current;
    if (!silent) setStatus('loading');
    setError(null);
    try {
      const [nextEvents, nextSummary, nextCalendar, nextHidden] = await Promise.all([
        eventService.getEvents(false),
        dashboardService.getDashboardSummary(),
        calendarService.getRegisteredEvents(),
        loadHidden(version),
      ]);
      if (version !== refreshVersion.current || inputAccount.scope !== account.current.scope) return false;
      setPlannerSnapshot({ ...inputAccount, version, key: plannerEventInputKey(nextEvents, nextCalendar, nextHidden) });
      setEvents(nextEvents);
      setSummary(nextSummary);
      setCalendarEvents(nextCalendar);
      setStatus('ready');
      return true;
    } catch (err) {
      if (version !== refreshVersion.current) return false;
      setError(err);
      setStatus('error');
      return false;
    }
  }, [loadHidden]);

  useEffect(() => {
    if (enabled) refresh();
    else ++refreshVersion.current; // 공개 화면으로 나간 뒤 이전 조회 응답을 반영하지 않는다.
  }, [refresh, enabled, profile.email]);
  useEffect(() => { if (enabled && sourcesVersion) refresh({ silent: true }); }, [sourcesVersion, refresh, enabled]);

  // Bundle writes can partially succeed in Google. Always reload the server's actual state.
  const runAction = useCallback(async (request) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    setActionBusy(true);
    setActionError(null);
    try {
      await request();
      const refreshed = await refresh({ silent: true });
      // 저장은 성공했으나 재조회가 실패했다면 이전 입력을 최신으로 취급하지 않는다.
      if (!refreshed) setPlannerSnapshot(current => current?.version === refreshVersion.current ? current : null);
      return refreshed;
    } catch (err) {
      await refresh({ silent: true });
      setActionError(err);
      return false;
    } finally {
      actionLock.current = false;
      setActionBusy(false);
    }
  }, [refresh]);

  const processRegistrations = useCallback(async (requests, continueQueue = false) => {
    // 비동기 조회와 busy 전환으로 열기 버튼이 포커스를 잃기 전에 보관한다.
    if (!continueQueue && !actionLock.current && typeof document !== 'undefined') registrationTrigger.current = document.activeElement;
    let queued = false;
    const ok = await runAction(async () => {
      for (let index = 0; index < requests.length; index += 1) {
        const request = requests[index];
        const detail = await eventService.getEventDetail(request.id);
        const targets = registrationTargets(detail, request);
        if (request.editing || needsConfirmation(targets)) {
          setRegistrationQueue(requests.slice(index));
          queued = true;
          return;
        }
        if (request.interview) await calendarService.registerInterview(request.id);
        else await calendarService.registerEvent(request.id);
      }
    });
    if (continueQueue && !queued) setRegistrationQueue([]);
    if (ok && !queued) {
      const message = requests.find((request) => request.successMessage)?.successMessage;
      if (message) showUndo(message);
    }
    return ok;
  }, [runAction, showUndo]);

  const toggleRegister = useCallback(
    (id) => {
      const event = eventsRef.current.find((item) => item.id === id);
      if (!event) return;
      const registered = !event.registered;
      if (registered) return processRegistrations([{ id, interview: event.event_type === 'interview' }]);
      return runAction(() => calendarService.unregisterEvent(id));
    },
    [runAction, processRegistrations],
  );

  const registerAll = useCallback(() => {
    // Register ordinary bundles directly; pause only for a bundle that needs confirmation.
    const ids = eventsRef.current.filter((event) => !event.registered && event.event_type !== 'interview').map((event) => event.id);
    return processRegistrations(ids.map((id) => ({ id, interview: false })));
  }, [processRegistrations]);

  const syncEvent = useCallback((id) => runAction(() => calendarService.syncEvent(id)), [runAction]);

  const toggleBookmark = useCallback(
    (id) => {
      const event = eventsRef.current.find((item) => item.id === id);
      if (!event) return;
      const bookmarked = !event.bookmarked;
      return runAction(() => eventService.setBookmark(id, bookmarked));
    },
    [runAction],
  );

  const registerInterview = useCallback((id) => processRegistrations([{ id, interview: true }]), [processRegistrations]);
  const requestRegistration = useCallback((id, interview = false, editing = false, successMessage) => processRegistrations([{ id, interview, editing, successMessage }]), [processRegistrations]);
  const unregisterDetailEvent = useCallback((id) => runAction(() => calendarService.unregisterEvent(id)), [runAction]);
  const setActionStatus = useCallback((id, status) => runAction(() => eventService.setActionStatus(id, status)), [runAction]);
  const setDismissed = useCallback((id, value) => runAction(() => eventService.setDismissed(id, value)), [runAction]);
  const updateOverrides = useCallback((id, overrides) => runAction(() => eventService.updateOverrides(id, overrides)), [runAction]);
  const saveBookmark = useCallback((id, value) => runAction(() => eventService.setBookmark(id, value)), [runAction]);

  const confirmRegistration = useCallback(async (overrides) => {
    const request = registrationQueue[0];
    if (!request) return false;
    const ok = await runAction(() => request.interview ? calendarService.registerInterview(request.id, overrides, true)
      : calendarService.registerEvent(request.id, overrides, true));
    if (ok) {
      if (request.successMessage) showUndo(request.successMessage);
      const remaining = registrationQueue.slice(1);
      if (remaining.length) await processRegistrations(remaining, true);
      else setRegistrationQueue([]);
    }
    return ok;
  }, [registrationQueue, runAction, processRegistrations, showUndo]);

  // D-day, 임박도 등 화면용 파생 값
  const enrichedEvents = useMemo(() => {
    const today = getToday();
    return events.filter(event => enabledSources[event.source] !== false).map((event) => enrichEvent(event, today));
  }, [events, enabledSources]);
  const enrichedCalendar = useMemo(() => calendarEvents.map((event) => enrichEvent(event, getToday())), [calendarEvents]);
  const enrichedHidden = useMemo(() => hiddenEvents.filter(event => enabledSources[event.source] !== false).map((event) => enrichEvent(event, getToday())), [hiddenEvents, enabledSources]);

  const clearActionError = useCallback(() => setActionError(null), []);
  const plannerEventKey = plannerSnapshot?.scope === profile.email && plannerSnapshot?.sourcesKey === plannerSourceKey
    ? plannerSnapshot.key : null;
  const value = useMemo(
    () => ({
      events: enrichedEvents,
      plannerEventKey,
      calendarEvents: enrichedCalendar,
      hiddenEvents: enrichedHidden,
      loadHidden,
      actionBusy,
      showUndo,
      updateOverrides,
      saveBookmark,
      setActionStatus,
      setDismissed,
      requestRegistration,
      registerInterview,
      unregisterDetailEvent,
      summary,
      status,
      error,
      actionError,
      clearActionError,
      refresh,
      toggleRegister,
      toggleBookmark,
      registerAll,
      syncEvent,
    }),
    [enrichedEvents, plannerEventKey, enrichedCalendar, enrichedHidden, loadHidden, actionBusy, showUndo, updateOverrides, saveBookmark, setActionStatus, setDismissed, requestRegistration, registerInterview, unregisterDetailEvent, summary, status, error, actionError, clearActionError, refresh, toggleRegister, toggleBookmark, registerAll, syncEvent],
  );

  return <AppDataContext.Provider value={value}>{children}
    <UndoToast toast={undoToast} busy={actionBusy} onUndo={async () => {
      const current = undoToast;
      if (!current?.undo) return;
      if (await current.undo()) setUndoToast((latest) => latest === current ? null : latest);
    }} />
    {registrationQueue[0] && <RegisterConfirmDialog request={registrationQueue[0]} busy={actionBusy} triggerRef={registrationTrigger}
      onCancel={() => setRegistrationQueue([])} onConfirm={confirmRegistration} />}
  </AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData 는 AppDataProvider 안에서만 사용할 수 있습니다.');
  return context;
}
