import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallback, useRef } from 'react';
import InterestSelector from '../components/InterestSelector';
import SettingsRow from '../components/SettingsRow';
import Toggle from '../components/Toggle';
import LoadError from '../components/LoadError';
import { ProfileFields, NotificationFields, SaveIndicator, SettingsLoading } from '../components/SettingsFields';
import { SOURCES } from '../config/sources';
import { useUser } from '../context/UserContext';
import { canToggleSource } from '../utils/settings';
import { logout, deleteAccount } from '../services/userService';
import DeleteAccountDialog from '../components/DeleteAccountDialog';

function Section({ title, description, children }) {
  return <section className="settings-section"><h2>{title}</h2>{description && <p className="settings-description">{description}</p>}{children}</section>;
}
export default function SettingsPage() {
  const { profile, preferences, status, reloadUser, saveStates = {}, updateProfile, toggleInterest, setSource, setNotification, retrySave, resetAccount } = useUser();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTrigger = useRef(null);
  const closeDelete = useCallback(() => setDeleteOpen(false), []);
  if (status === 'loading') return <SettingsLoading />;
  if (status === 'error') return <LoadError message="설정을 불러오지 못했어요." onRetry={reloadUser} />;
  return <div className="settings-card">
    <Section title="프로필" description="추천과 지원 조건 확인에 써요."><ProfileFields profile={profile} onChange={updateProfile} states={saveStates} onRetry={retrySave} /></Section>
    <Section title="관심분야" description="고른 분야의 새 공지를 먼저 보여 주고, AI 플래너가 참고해요.">
      <InterestSelector selected={preferences.interests} onToggle={toggleInterest} state={saveStates['preferences.interests']} />
      <SaveIndicator field="preferences.interests" states={saveStates} onRetry={retrySave} />
    </Section>
    <Section title="공지 출처" description="끄면 그 사이트 공지를 목록과 알림에서 빼요.">
      {SOURCES.map(source => {
        const checked = preferences.enabled_sources[source.id] !== false;
        const blocked = checked && !canToggleSource(preferences.enabled_sources, source.id, false);
        const field = `preferences.enabled_sources.${source.id}`;
        return <SettingsRow key={source.id} name={source.label} sub={blocked ? <span id={`source-help-${source.id}`}>하나 이상 켜 두어야 해요</span> : null}>
          <SaveIndicator field={field} states={saveStates} onRetry={retrySave} />
          <Toggle checked={checked} onChange={value => setSource(source.id, value)} label={source.label} disabled={blocked} state={saveStates[field]} describedBy={blocked ? `source-help-${source.id}` : undefined} />
        </SettingsRow>;
      })}
    </Section>
    <Section title="알림" description="등록하거나 관심 저장한 일정의 마감 전에 알려 드려요.">
      <NotificationFields notifications={preferences.notifications} email={profile.email} onChange={setNotification} states={saveStates} onRetry={retrySave} />
    </Section>
    <Section title="계정">
      <div className="settings-account"><span className="settings-avatar" aria-hidden="true">{profile.name.slice(0, 1)}</span><div><p className="settings-account-label">Google 계정</p><strong>{profile.name}</strong><p className="settings-description">{profile.email}</p></div>
        <button className="settings-button" type="button" disabled={busy} onClick={async () => { if (busy) return; setBusy(true); setError(''); try { await logout(); navigate('/', { replace: true }); } catch { setError('로그아웃하지 못했어요. 다시 시도해 주세요.'); } finally { setBusy(false); } }}>{busy ? '로그아웃 중…' : '로그아웃'}</button>
      </div>{error && <p className="settings-error" role="alert">{error}</p>}
      <div className="settings-delete-row"><button ref={deleteTrigger} type="button" className="settings-button quiet danger-text" disabled={busy} onClick={() => setDeleteOpen(true)}>계정 삭제</button></div>
    </Section>
    {deleteOpen && <DeleteAccountDialog triggerRef={deleteTrigger} onCancel={closeDelete} onDelete={async () => {
      await deleteAccount(); resetAccount(); navigate('/', { replace: true });
    }} />}
  </div>;
}
