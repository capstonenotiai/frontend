import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_AI_MODE_ID, getAiMode } from '../config/aiModes';
import * as userService from '../services/userService';

/**
 * 사용자 정보 + 설정(preferences).
 *  - ai_mode 변경(AI 플래너 모드 카드)은 즉시 저장
 *  - 설정 화면의 토글은 화면에 먼저 반영하고 탑바 '저장' 버튼으로 저장
 */
const UserContext = createContext(null);

const EMPTY_PREFERENCES = {
  ai_mode: DEFAULT_AI_MODE_ID,
  interests: [],
  enabled_sources: {},
  notifications: {},
  auto_mode_recommend: false,
};

export function UserProvider({ children }) {
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const [status, setStatus] = useState('loading');
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  useEffect(() => {
    let cancelled = false;
    Promise.all([userService.getProfile(), userService.getPreferences()])
      .then(([nextProfile, nextPreferences]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setPreferences({ ...EMPTY_PREFERENCES, ...nextPreferences });
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  /** 화면 상태만 변경 (저장은 savePreferences) */
  const updatePreferences = useCallback((updater) => {
    setSaveState('idle');
    setPreferences((current) => (typeof updater === 'function' ? updater(current) : { ...current, ...updater }));
  }, []);

  const savePreferences = useCallback(async (next = preferencesRef.current) => {
    setSaveState('saving');
    try {
      await userService.updatePreferences(next);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  /** AI 모드 선택 — 즉시 저장 */
  const setAiMode = useCallback(
    (modeId) => {
      const next = { ...preferencesRef.current, ai_mode: modeId };
      setPreferences(next);
      savePreferences(next);
    },
    [savePreferences],
  );

  const toggleInterest = useCallback(
    (interestId) =>
      updatePreferences((current) => {
        const interests = current.interests.includes(interestId)
          ? current.interests.filter((id) => id !== interestId)
          : [...current.interests, interestId];
        return { ...current, interests };
      }),
    [updatePreferences],
  );

  const value = useMemo(
    () => ({
      profile,
      preferences,
      activeMode: getAiMode(preferences.ai_mode),
      status,
      saveState,
      updatePreferences,
      savePreferences,
      setAiMode,
      toggleInterest,
    }),
    [profile, preferences, status, saveState, updatePreferences, savePreferences, setAiMode, toggleInterest],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser 는 UserProvider 안에서만 사용할 수 있습니다.');
  return context;
}
