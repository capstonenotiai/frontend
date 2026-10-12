import { hasInterest } from '../utils/settings';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { ProfileFields, NotificationFields } from '../components/SettingsFields';
import InterestSelector from '../components/InterestSelector';
import LoadError from '../components/LoadError';

export default function WelcomePage() {
  const { profile, preferences, status, reloadUser, saveProfileStep, savePreferencesStep, completeOnboarding } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(0), [draft, setDraft] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const draftRef = useRef(null), lock = useRef(false), heading = useRef(null);
  useEffect(() => {
    if (status === 'ready' && !draftRef.current) {
      draftRef.current = { profile: { ...profile }, interests: [...preferences.interests], notifications: { ...preferences.notifications } };
      setDraft(draftRef.current);
    }
  }, [status, profile, preferences]);
  useEffect(() => { heading.current?.focus(); }, [step, draft !== null]);
  const change = patch => { draftRef.current = { ...draftRef.current, ...patch }; setDraft(draftRef.current); };
  const advance = async () => {
    setError('');
    if (step < 2) setStep(value => value + 1);
    else { await completeOnboarding(); navigate('/dashboard', { replace: true }); }
  };
  const skip = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await advance(); } catch { setError('완료 상태를 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const titles = ['프로필', '관심분야', '알림'];
  return <main className="welcome-page"><div className="welcome-card"><header className="welcome-header"><strong>NotiAI</strong><span aria-label={`3단계 중 ${step + 1}단계`}>{step + 1}/3</span></header>
    <div className="welcome-progress" aria-hidden="true">{titles.map((title, index) => <span key={title} className={index <= step ? 'is-done' : ''} />)}</div>
    <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1><p className="settings-description">{['추천과 지원 조건 확인에 써요.', '고른 분야의 새 공지를 먼저 보여 주고, AI 플래너가 참고해요.', '등록하거나 관심 저장한 일정의 마감 전에 알려 드려요.'][step]}</p>
    {status === 'error' ? <LoadError message="설정을 불러오지 못했어요." onRetry={reloadUser} /> : !draft ? <div className="settings-placeholder" role="status" aria-label="설정을 불러오는 중" /> : <>
      {step === 0 && <ProfileFields profile={draft.profile} disabled={busy} onChange={patch => change({ profile: { ...draftRef.current.profile, ...patch } })} />}
      {step === 1 && <InterestSelector selected={draft.interests} disabled={busy} onToggle={id => change({ interests: draft.interests.includes(id) ? draft.interests.filter(value => value !== id) : [...draft.interests, id] })} />}
      {step === 2 && <NotificationFields notifications={draft.notifications} email={profile.email} disabled={busy} onChange={(id, value) => change({ notifications: { ...draftRef.current.notifications, [id]: value } })} />}
      {error && <p className="settings-error" role="alert">{error}</p>}
      <footer className="welcome-actions">{/* 관심분야 단계는 건너뛰지 않는다(사용자 결정) */}{step === 1 ? <span /> : <button type="button" className="settings-button quiet" disabled={busy} onClick={skip}>나중에 하기</button>}<button type="button" className="settings-button primary" disabled={busy || (step === 1 && !hasInterest(draft.interests))} aria-describedby={step === 1 ? 'interest-help' : undefined} onClick={async () => {
        if (lock.current) return; lock.current = true; setBusy(true); setError('');
        try {
          const current = draftRef.current;
          const saved = step === 0 ? await saveProfileStep(current.profile) : await savePreferencesStep(step === 1 ? { interests: current.interests } : { notifications: current.notifications });
          if (saved) await advance(); else setError('저장하지 못했어요. 다시 시도하거나 나중에 해 주세요.');
        } catch (err) { setError(err.message); }
        finally { lock.current = false; setBusy(false); }
      }}>{busy ? '저장 중…' : step === 2 ? '시작하기' : '다음'}</button></footer>
    </>}
  </div></main>;
}
