import { useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { getToday, toISODate } from '../../utils/date';
import { formatScheduleWhen } from '../../utils/scheduleWhen';
import { TYPE_LABELS } from '../../utils/eventLabels';
import './events.css';

const FIELDS = [['start_date', '시작일', 'date'], ['end_date', '종료일', 'date'], ['start_time', '시작 시각', 'time'], ['end_time', '종료 시각', 'time'], ['location', '장소', 'text']];

function EditEvent({ item, onClose }) {
  const { actionBusy, updateOverrides } = useAppData();
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map(([key]) => [key, item[key] || ''])));
  const save = async (patch) => { if (await updateOverrides(item.id, patch)) onClose(); };
  return <form className="event-edit" onSubmit={(e) => {
    e.preventDefault();
    const patch = Object.fromEntries(FIELDS.filter(([key]) => values[key] !== (item[key] || '')).map(([key]) => [key, values[key]]));
    if (Object.keys(patch).length) save(patch); else onClose();
  }}>
    <fieldset disabled={actionBusy}><legend>{TYPE_LABELS[item.event_type] || '일정'} 수정</legend>
      <div className="event-edit-fields">{FIELDS.map(([key, label, type]) => <label key={key}>{label}
        <input type={type} value={values[key]} maxLength={key === 'location' ? 255 : undefined}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
      </label>)}</div>
      <div className="event-edit-actions">
        <button type="button" className="event-link" onClick={() => save(Object.fromEntries(FIELDS.map(([key]) => [key, null])))}>원래대로</button>
        <button type="button" className="event-button quiet" onClick={onClose}>취소</button>
        <button type="submit" className="event-button primary">저장</button>
      </div>
      {item.registered && <p className="event-meta">저장하면 Google 캘린더에 다시 반영해야 해요.</p>}
    </fieldset>
  </form>;
}

export default function NoticeTimeline({ items, currentId, editable = false, showActions = false, notificationTargetId }) {
  const { actionBusy, syncEvent, unregisterDetailEvent, requestRegistration, showUndo } = useAppData();
  const [editing, setEditing] = useState(null);
  const today = toISODate(getToday());
  const event = { id: currentId };
  const timeline = [...items].sort((a, b) => (a.start_date || a.end_date || '9999').localeCompare(b.start_date || b.end_date || '9999') || (a.start_time || '').localeCompare(b.start_time || ''));
  const removeRegistration = async (item, interview = false) => {
    if (await unregisterDetailEvent(item.id)) showUndo('등록을 해제했어요. Google 캘린더에서도 빠져요.', () => requestRegistration(item.id, interview));
  };
  return (
      <ol className="event-timeline">{timeline.map((item) => <li key={item.id} aria-current={notificationTargetId != null && String(item.id) === String(notificationTargetId) ? 'true' : undefined}
        className={`event-timeline-item ${String(item.id) === String(notificationTargetId ?? event.id) ? 'is-current' : ''} ${(item.end_date || item.start_date) && (item.end_date || item.start_date) < today ? 'is-past' : ''}`}>
        <span className="event-timeline-dot" aria-hidden="true" /><div>
          {editing === item.id ? <EditEvent item={item} onClose={() => setEditing(null)} /> : <>
            <div className="event-timeline-title"><strong>{TYPE_LABELS[item.event_type] || '일정'}</strong>
              {notificationTargetId != null && String(item.id) === String(notificationTargetId) && <span className="event-meta">알림 대상 · {item.registered ? '등록됨' : '미등록'}{item.action_status === 'done' ? ' · 완료' : ''}</span>}
              {item.user_modified && <span className="event-meta">내가 수정함</span>}
              {editable && <button type="button" className="event-edit-link" disabled={actionBusy} onClick={() => setEditing(item.id)}>수정</button>}
            </div>
            <p className="event-timeline-meta">{formatScheduleWhen(item)}{item.location && ` · ${item.location}`}</p>
          </>}
          {showActions && item.registered && item.id !== event.id && ['needs_sync', 'failed'].includes(item.sync_status) && <p className="event-meta">Google 캘린더에 아직 반영되지 않았어요. <button type="button" className="event-link" disabled={actionBusy} onClick={() => syncEvent(item.id)}>다시 반영</button></p>}
          {showActions && item.event_type === 'interview' && <><button type="button" className="event-button quiet" disabled={actionBusy || (!item.registered && item.can_register === false)}
            onClick={() => item.registered ? removeRegistration(item, true) : requestRegistration(item.id, true)}>{item.registered ? '따로 추가 해제' : '캘린더에 따로 추가'}</button>
            {!item.registered && item.can_register === false && <p className="event-meta">{item.registration_reason}</p>}</>}
        </div>
      </li>)}</ol>
  );
}
