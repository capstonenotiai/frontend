import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { useCalendarMonth } from '../hooks/useCalendarMonth';
import { formatMonthLabel } from '../utils/date';

/** 앱 상단 바. 제목과 오른쪽 버튼 구성은 config/navigation.js 의 page.actions 를 따른다 */
export default function Topbar({ page }) {
  const navigate = useNavigate();
  const { events, summary, refresh, registerAll } = useAppData();
  const { savePreferences, saveState } = useUser();
  const calendarMonth = useCalendarMonth();
  const [busyAction, setBusyAction] = useState(null);

  const context = {
    eventCount: events.length,
    lastCollectedAt: summary?.lastCollectedAt ?? '--:--',
    calendarMonthLabel: formatMonthLabel(calendarMonth.year, calendarMonth.month),
  };

  const handlers = {
    refresh,
    registerAll,
    savePreferences: () => savePreferences(),
    scrollToModes: () => document.getElementById('planner-modes')?.scrollIntoView({ behavior: 'smooth' }),
  };

  const runAction = async (name) => {
    const handler = handlers[name];
    if (!handler) return;
    setBusyAction(name);
    try {
      await handler();
    } finally {
      setBusyAction(null);
    }
  };

  const buttonLabel = (action) => {
    if (action.action === 'savePreferences') {
      if (saveState === 'saving') return '저장 중…';
      if (saveState === 'saved') return '저장됨 ✓';
      if (saveState === 'error') return '저장 실패 · 다시 시도';
    }
    return action.label;
  };

  return (
    <header className="topbar">
      <span className="tb-title">
        NotiAI <span>/ {page?.label}</span>
      </span>
      <div className="tb-r">
        {(page?.actions ?? []).map((action) => {
          if (action.kind === 'tag') {
            const text = typeof action.text === 'function' ? action.text(context) : action.text;
            return (
              <span key={`tag-${text}`} className="tb-tag">
                {text}
              </span>
            );
          }
          const isPlaceholder = !action.to && !action.action;
          return (
            <button
              key={action.label}
              type="button"
              className={`btn-sm ${action.variant}`}
              disabled={busyAction === action.action && !!action.action}
              title={isPlaceholder ? '준비 중인 기능입니다' : undefined}
              onClick={() => {
                if (action.to) navigate(action.to);
                else if (action.action) runAction(action.action);
              }}
            >
              {buttonLabel(action)}
            </button>
          );
        })}
      </div>
    </header>
  );
}
