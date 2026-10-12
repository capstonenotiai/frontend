import { useEffect, useState } from 'react';
import SettingsRow from './SettingsRow';
import Toggle from './Toggle';
import { ENROLLMENT_OPTIONS, NOTIFICATION_OPTIONS } from '../utils/settings';

export function SaveIndicator({ field, states = {}, onRetry }) {
  const state = states[field];
  return <span className={`save-indicator ${state === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">
    {state === 'saving' ? '저장 중…' : state === 'saved' ? '저장됨' : state === 'error' ? <>저장하지 못했어요. <button type="button" className="settings-retry" onClick={() => onRetry(field)}>다시 시도</button></> : ''}
  </span>;
}

export function ProfileFields({ profile, onChange, states = {}, onRetry, disabled = false }) {
  const [major, setMajor] = useState(profile.major ?? '');
  useEffect(() => { setMajor(profile.major ?? ''); }, [profile.major]);
  const status = field => <SaveIndicator field={`profile.${field}`} states={states} onRetry={onRetry} />;
  return <div className="profile-fields">
    <label className="settings-field">전공
      <input className="settings-input" aria-label="전공" placeholder="예: 소프트웨어학부" maxLength={255} value={major} disabled={disabled}
        aria-invalid={states['profile.major'] === 'error' || undefined} aria-busy={states['profile.major'] === 'saving' || undefined} data-state={states['profile.major'] || 'idle'}
        onChange={event => setMajor(event.target.value)} onBlur={() => { if (major !== (profile.major ?? '')) onChange({ major }, 'major'); }} />
      {status('major')}
    </label>
    <fieldset disabled={disabled} className="settings-field"><legend>학년</legend><div className="settings-segments">
      {[1, 2, 3, 4, 5, 6, null].map(grade => <button type="button" key={grade ?? 'none'} aria-pressed={(profile.grade ?? null) === grade} data-state={states['profile.grade'] || 'idle'} onClick={() => { if (profile.grade !== grade) onChange({ grade }, 'grade'); }}>{grade === null ? '선택 안 함' : `${grade}학년`}</button>)}
    </div>{status('grade')}</fieldset>
    <fieldset disabled={disabled} className="settings-field"><legend>재학 상태</legend><div className="settings-segments">
      {ENROLLMENT_OPTIONS.map(([id, label]) => <button type="button" key={id} aria-pressed={(profile.enrollment_status ?? 'unknown') === id} data-state={states['profile.enrollment_status'] || 'idle'} onClick={() => { if (profile.enrollment_status !== id) onChange({ enrollment_status: id }, 'enrollment_status'); }}>{label}</button>)}
    </div>{status('enrollment_status')}</fieldset>
  </div>;
}

export function NotificationFields({ notifications, email, onChange, states = {}, onRetry, disabled = false }) {
  return <div>{NOTIFICATION_OPTIONS.map(([id, label]) => {
    const field = `preferences.notifications.${id}`;
    return <SettingsRow key={id} name={label} sub={id === 'email' ? email : null}>
      <SaveIndicator field={field} states={states} onRetry={onRetry} />
      <Toggle checked={notifications[id] !== false} onChange={value => onChange(id, value)} label={label} disabled={disabled} state={states[field]} />
    </SettingsRow>;
  })}</div>;
}

export function SettingsLoading() {
  return <div className="settings-card settings-loading" role="status" aria-label="설정을 불러오는 중">
    {['프로필', '관심분야', '공지 출처', '알림', '계정'].map(title => <section className="settings-section" key={title}><h2>{title}</h2><div className="settings-placeholder" /><div className="settings-placeholder short" /></section>)}
  </div>;
}
