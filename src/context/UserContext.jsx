import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_AI_MODE_ID, getAiMode } from '../config/aiModes';
import * as userService from '../services/userService';
import { emptyAccountState, clearAccountStorage } from '../utils/account';
import { buildPreferencesBody, buildProfileBody, canToggleSource, createSaveQueue } from '../utils/settings';

const UserContext = createContext(null);
const EMPTY_PROFILE = { name: '', email: '', major: '', grade: null, enrollment_status: 'unknown' };
const EMPTY_PREFERENCES = { ai_mode: DEFAULT_AI_MODE_ID, ...buildPreferencesBody({}), auto_mode_recommend: false };

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const [status, setStatus] = useState('loading');
  const [saveStates, setSaveStates] = useState({});
  const [sourcesVersion, setSourcesVersion] = useState(0);
  const [sessionVersion, setSessionVersion] = useState(0);
  const profileRef = useRef(profile), preferencesRef = useRef(preferences);
  const states = useRef({}), revisions = useRef({}), timers = useRef({});
  const mounted = useRef(false), loadVersion = useRef(0);
  const accountVersion = useRef(0);
  const queues = useRef(null);
  if (!queues.current) queues.current = { profile: createSaveQueue(), preferences: createSaveQueue() };
  const publish = useCallback((key, state) => {
    states.current = { ...states.current, [key]: state };
    if (mounted.current) setSaveStates(states.current);
  }, []);

  const reloadUser = useCallback(async () => {
    const version = ++loadVersion.current;
    setStatus('loading');
    try {
      const [p, prefs] = await Promise.all([userService.getProfile(), userService.getPreferences()]);
      if (!mounted.current || version !== loadVersion.current) return;
      profileRef.current = { ...EMPTY_PROFILE, ...p };
      preferencesRef.current = { ...EMPTY_PREFERENCES, ...prefs, ...buildPreferencesBody(prefs) };
      setProfile(profileRef.current); setPreferences(preferencesRef.current); setStatus('ready');
    } catch { if (mounted.current && version === loadVersion.current) setStatus('error'); }
  }, []);
  useEffect(() => {
    mounted.current = true; reloadUser();
    return () => { mounted.current = false; ++loadVersion.current; Object.values(timers.current).forEach(clearTimeout); };
  }, [reloadUser]);

  const save = useCallback((group, body, key) => {
    const account = accountVersion.current;
    clearTimeout(timers.current[key]);
    revisions.current[key] = (revisions.current[key] || 0) + 1;
    publish(key, 'saving');
    // Each full snapshot also persists earlier failed fields in the same group.
    const included = Object.fromEntries(Object.entries(revisions.current).filter(([id]) => id.startsWith(`${group}.`)));
    return queues.current[group](async () => {
      if (account !== accountVersion.current) return false;
      try {
        await (group === 'profile' ? userService.updateProfile(body) : userService.updatePreferences(body));
        if (account !== accountVersion.current) return false;
        if (group === 'preferences' && mounted.current) setSourcesVersion(version => version + 1);
        for (const [id, version] of Object.entries(included)) {
          if (revisions.current[id] !== version || !['saving', 'error'].includes(states.current[id])) continue;
          clearTimeout(timers.current[id]); publish(id, 'saved');
          timers.current[id] = setTimeout(() => { if (revisions.current[id] === version) publish(id, 'idle'); }, 2000);
        }
        return true;
      } catch {
        if (account !== accountVersion.current) return false;
        // A newer snapshot remains queued; do not replace its saving indicator.
        for (const [id, version] of Object.entries(included)) if (revisions.current[id] === version && states.current[id] !== 'saved' && states.current[id] !== 'idle') publish(id, 'error');
        return false;
      }
    });
  }, [publish]);

  const updateProfile = useCallback((patch, field = Object.keys(patch)[0]) => {
    const next = { ...profileRef.current, ...patch };
    const body = buildProfileBody(next);
    profileRef.current = next; setProfile(next);
    return save('profile', body, `profile.${field}`);
  }, [save]);
  const updatePreferences = useCallback((updater, field = 'interests') => {
    const current = preferencesRef.current;
    const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    preferencesRef.current = next; setPreferences(next);
    return save('preferences', buildPreferencesBody(next), `preferences.${field}`);
  }, [save]);
  const toggleInterest = useCallback(id => updatePreferences(current => ({ ...current, interests: current.interests.includes(id) ? current.interests.filter(value => value !== id) : [...current.interests, id] }), 'interests'), [updatePreferences]);
  const setSource = useCallback((id, value) => {
    if (!canToggleSource(preferencesRef.current.enabled_sources, id, value)) return Promise.resolve(false);
    return updatePreferences(current => ({ ...current, enabled_sources: { ...current.enabled_sources, [id]: value } }), `enabled_sources.${id}`);
  }, [updatePreferences]);
  const setNotification = useCallback((id, value) => updatePreferences(current => ({ ...current, notifications: { ...current.notifications, [id]: value } }), `notifications.${id}`), [updatePreferences]);
  const retrySave = useCallback(key => {
    const group = key.startsWith('profile.') ? 'profile' : 'preferences';
    return save(group, group === 'profile' ? buildProfileBody(profileRef.current) : buildPreferencesBody(preferencesRef.current), key);
  }, [save]);
  // Preserved old components can select a local mode; no AI setting is sent to the server.
  const setAiMode = useCallback(id => {
    preferencesRef.current = { ...preferencesRef.current, ai_mode: getAiMode(id).id };
    setPreferences(preferencesRef.current);
  }, []);
  const saveProfileStep = useCallback(values => updateProfile(values, 'step'), [updateProfile]);
  const savePreferencesStep = useCallback(patch => updatePreferences(patch, 'step'), [updatePreferences]);
  const completeOnboarding = useCallback(async () => {
    const next = await userService.completeOnboarding();
    profileRef.current = { ...profileRef.current, ...next };
    setProfile(profileRef.current);
  }, []);
  const resetAccount = useCallback(() => {
    ++accountVersion.current;
    let session, local;
    try { session = globalThis.sessionStorage; } catch { /* 저장 접근 제한 */ }
    try { local = globalThis.localStorage; } catch { /* 저장 접근 제한 */ }
    clearAccountStorage(profileRef.current.email, session, local);
    ++loadVersion.current;
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {}; states.current = {}; revisions.current = {};
    const empty = emptyAccountState();
    profileRef.current = empty.profile; preferencesRef.current = empty.preferences;
    setProfile(empty.profile); setPreferences(empty.preferences); setSaveStates(empty.saveStates);
    setSourcesVersion(0); setStatus('ready');
    setSessionVersion(value => value + 1);
  }, []);
  return <UserContext.Provider value={{ profile, preferences, status, reloadUser, saveStates, sourcesVersion, sessionVersion, resetAccount, completeOnboarding, updateProfile, updatePreferences, toggleInterest, setSource, setNotification, retrySave, saveProfileStep, savePreferencesStep, activeMode: getAiMode(preferences.ai_mode), setAiMode }}>{children}</UserContext.Provider>;
}
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser 는 UserProvider 안에서만 사용할 수 있습니다.');
  return context;
}
