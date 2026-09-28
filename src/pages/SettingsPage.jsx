import { useNavigate } from 'react-router-dom';
import Badge from '../components/Badge';
import Card from '../components/Card';
import InterestSelector from '../components/InterestSelector';
import SettingsRow from '../components/SettingsRow';
import Toggle from '../components/Toggle';
import { FEATURE_FLAGS } from '../config/app';
import { SOURCES } from '../config/sources';
import { useUser } from '../context/UserContext';

/** 알림 설정 항목 — preferences.notifications 의 key 와 매핑 */
const NOTIFICATION_OPTIONS = [
  { key: 'd7', name: 'D-7 알림', sub: '마감 7일 전 알림' },
  { key: 'd3', name: 'D-3 긴급 알림', sub: '마감 3일 전 긴급 알림' },
  { key: 'new_event', name: '새 일정 알림', sub: '새로 수집된 일정 즉시 알림' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, preferences, activeMode, updatePreferences, toggleInterest } = useUser();

  const setNested = (group, key, value) =>
    updatePreferences((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));

  const enabledSourceCount = SOURCES.filter((source) => preferences.enabled_sources[source.id]).length;

  return (
    <>
      <div className="page-header">
        <div className="page-title">설정</div>
        <div className="page-sub">계정 및 알림 설정을 관리하세요</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
        <Card title="계정 정보" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="sb-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
              {profile.name.slice(0, 1)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{profile.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t3)' }}>{profile.email}</div>
            </div>
            {/* TODO: Google OAuth 연동 후 구현 */}
            <button type="button" className="btn-sm ghost" style={{ marginLeft: 'auto' }} title="준비 중인 기능입니다">
              Google 재연결
            </button>
          </div>
        </Card>

        <Card
          title="연동 사이트"
          headerRight={<Badge tone="blue">{enabledSourceCount}개 활성</Badge>}
          bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {SOURCES.map((source) => (
            <SettingsRow key={source.id} name={source.label} sub={`${source.type} · 매일 09:00 수집`}>
              <Toggle
                label={`${source.label} 수집`}
                checked={!!preferences.enabled_sources[source.id]}
                onChange={(value) => setNested('enabled_sources', source.id, value)}
              />
            </SettingsRow>
          ))}
        </Card>

        <Card title="알림 설정" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NOTIFICATION_OPTIONS.map((option) => (
            <SettingsRow key={option.key} name={option.name} sub={option.sub}>
              <Toggle
                label={option.name}
                checked={!!preferences.notifications[option.key]}
                onChange={(value) => setNested('notifications', option.key, value)}
              />
            </SettingsRow>
          ))}
        </Card>

        {FEATURE_FLAGS.interestSettings && (
          <Card title="관심 분야" headerRight={<Badge tone="blue">{preferences.interests.length}개 선택</Badge>}>
            <InterestSelector selected={preferences.interests} onToggle={toggleInterest} />
          </Card>
        )}

        <Card title="AI 플래너 설정" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SettingsRow name="기본 모드" sub={`현재: ${activeMode.name}`}>
            <button type="button" className="btn-sm ghost" style={{ fontSize: 12 }} onClick={() => navigate('/planner')}>
              변경
            </button>
          </SettingsRow>
          <SettingsRow name="자동 모드 추천" sub="AI가 상황에 따라 모드를 추천">
            <Toggle
              label="자동 모드 추천"
              checked={preferences.auto_mode_recommend}
              onChange={(value) => updatePreferences({ auto_mode_recommend: value })}
            />
          </SettingsRow>
        </Card>
      </div>
    </>
  );
}
