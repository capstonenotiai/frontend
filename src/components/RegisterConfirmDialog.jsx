import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEventDetail } from '../services/eventService';
import { registrationTargets, flaggedFields, confirmationReason } from '../utils/registration';
import { dateLines } from '../utils/adminReview';
import './RegisterConfirmDialog.css';

const FIELDS = [['start_date', '시작일', 'date'], ['end_date', '종료·마감일', 'date'],
  ['start_time', '시작 시각', 'time'], ['end_time', '종료·마감 시각', 'time'], ['location', '장소', 'text']];
const TYPES = { application: '접수', submission: '제출', event: '본행사', interview: '면접' };
const WEEKDAYS = '일월화수목금토';

function shortDate(value) {
  const [y, m, d] = (value || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

/** 요약 한 줄: [{ text, flagged }] 조각. 같은 날이면 날짜를 한 번만 쓴다. */
function summaryParts(values, flags) {
  const { start_date: sd, end_date: ed, start_time: st, end_time: et } = values;
  const join = (...parts) => parts.filter(Boolean).join(' ');
  const startFlag = flags.has('start_date') || flags.has('start_time');
  const endFlag = flags.has('end_date') || flags.has('end_time');
  if (!sd && !ed) return [{ text: '날짜 정보 없음', flagged: startFlag || endFlag }];
  if (sd && ed && sd !== ed) return [{ text: join(shortDate(sd), st), flagged: startFlag }, { text: ' ~ ' }, { text: join(shortDate(ed), et), flagged: endFlag }];
  const day = shortDate(ed || sd);
  if (!ed && endFlag) return [{ text: join(day, st), flagged: startFlag }, { text: ' ~ ' }, { text: '마감일 없음', flagged: true }];
  const times = st && et && st !== et ? `${st} ~ ${et}` : st || et;
  return [{ text: join(day, times), flagged: startFlag || endFlag }];
}

export default function RegisterConfirmDialog({ request, busy, onCancel, onConfirm, triggerRef }) {
  const [items, setItems] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [lines, setLines] = useState([]);
  const [editingRows, setEditingRows] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const backdrop = useRef(null), panel = useRef(null), title = useRef(null);
  const activeRequest = useRef(request), submission = useRef(null);
  const restoreFrame = useRef(null);
  const actions = useRef({ busy, onCancel });
  const titleId = useId(), descriptionId = useId();
  const blocked = busy || submitting;
  useLayoutEffect(() => { actions.current = { busy: blocked, onCancel }; });
  useLayoutEffect(() => {
    cancelAnimationFrame(restoreFrame.current);
    const origin = triggerRef?.current || document.activeElement;
    const originRow = origin?.closest('.event-item');
    const focusKey = origin?.getAttribute('data-registration-focus');
    const background = new Map();
    const isolate = () => {
      for (const node of document.body.children) {
        if (node === backdrop.current || node.contains(backdrop.current) || background.has(node)) continue;
        background.set(node, { inert: node.getAttribute('inert'), hidden: node.getAttribute('aria-hidden') });
        node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true');
      }
    };
    title.current?.focus();
    isolate();
    const observer = new MutationObserver(isolate);
    observer.observe(document.body, { childList: true });
    const keepFocus = event => { if (!panel.current?.contains(event.target)) title.current?.focus(); };
    const keyboard = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!actions.current.busy && !submission.current) actions.current.onCancel();
      }
      if (event.key !== 'Tab') return;
      event.stopPropagation();
      const controls = [...panel.current.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
        .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[inert]')
          && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
      const first = controls[0], last = controls.at(-1);
      if (!controls.length) { event.preventDefault(); title.current?.focus(); }
      else if (!controls.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('focusin', keepFocus, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      activeRequest.current = null;
      observer.disconnect();
      document.removeEventListener('focusin', keepFocus, true);
      document.removeEventListener('keydown', keyboard, true);
      for (const [node, previous] of background) {
        for (const [name, value] of [['inert', previous.inert], ['aria-hidden', previous.hidden]]) {
          if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
        }
      }
      // 성공 시 같은 커밋에서 버튼의 disabled/등록 상태도 바뀐다. DOM 갱신 뒤 복원한다.
      const restoreFocus = (useFallback = false) => {
        const replacement = focusKey && [...(originRow?.querySelectorAll('[data-registration-focus]') || [])]
          .find(node => node.getAttribute('data-registration-focus') === focusKey);
        const target = replacement || origin;
        if (target?.isConnected && !target.matches(':disabled') && !target.closest('[inert], [hidden], [aria-hidden="true"]')
          && target.getClientRects().length) {
          target.focus({ preventScroll: true });
          if (document.activeElement === target && target !== document.body) return;
        }
        if (!useFallback) return;
        const fallback = document.querySelector('main, [role="main"]') || document.body;
        if (!fallback.hasAttribute('tabindex')) {
          fallback.setAttribute('tabindex', '-1');
          fallback.addEventListener('blur', () => fallback.removeAttribute('tabindex'), { once: true });
        }
        fallback.focus({ preventScroll: true });
      };
      restoreFocus();
      restoreFrame.current = requestAnimationFrame(() => restoreFocus(true));
    };
  }, [triggerRef]);
  useLayoutEffect(() => {
    activeRequest.current = request;
    submission.current = null;
    setItems(null); setOverrides({}); setLines([]); setEditingRows({}); setError(''); setSubmitting(false);
    title.current?.focus();
  }, [request]);
  useLayoutEffect(() => {
    if (!panel.current?.contains(document.activeElement) || document.activeElement.matches(':disabled')) title.current?.focus();
  }, [blocked]);
  useEffect(() => {
    let cancelled = false;
    getEventDetail(request.id).then((detail) => {
      if (cancelled || activeRequest.current !== request) return;
      const targets = registrationTargets(detail, request);
      setItems(targets);
      setLines(Array.isArray(detail.date_lines) ? detail.date_lines : []);
      setOverrides(Object.fromEntries(targets.map((e) => [e.id, Object.fromEntries(FIELDS.map(([key]) => [key, e[key] || '']))])));
    }).catch((err) => { if (!cancelled && activeRequest.current === request) setError(err.message); });
    return () => { cancelled = true; };
  }, [request]);

  const editAll = Boolean(request.editing);
  const valuesOf = (item) => ({ ...item, ...overrides[item.id] });
  const changed = (items || []).some((item) => FIELDS.some(([key]) => (overrides[item.id]?.[key] || '') !== (item[key] || '')));
  const reasons = [...new Map((items || []).map((item) => [confirmationReason(item), TYPES[item.event_type] || '일정'])
    .filter(([reason]) => reason)).entries()];
  const highlighted = items && lines.length ? dateLines(lines.join('\n'), items.map(valuesOf)) : [];
  const sourceUrl = items?.find((item) => item.source_url)?.source_url;
  const rowId = (item) => `${titleId}-row-${item.id}`;
  const toggleRow = (item) => {
    const opening = !editingRows[item.id];
    setEditingRows((prev) => ({ ...prev, [item.id]: opening }));
    if (opening) requestAnimationFrame(() => document.getElementById(rowId(item))?.querySelector('input')?.focus());
  };

  const content = <div ref={backdrop} className="confirm-backdrop">
    <section ref={panel} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={blocked}>
      <h2 ref={title} id={titleId} tabIndex={-1}>{editAll ? '내 일정 수정' : '날짜를 확인해 주세요'}</h2>
      {items?.[0] && <p className="confirm-sub">{items[0].title}</p>}
      {reasons.length > 0 && <div className="confirm-reason">
        <span className="confirm-reason-mark" aria-hidden="true">!</span>
        <ul>{reasons.map(([reason, type]) => <li key={reason}>{reasons.length > 1 || (items?.length || 0) > 1 ? <strong>{type} · </strong> : null}{reason}</li>)}</ul>
      </div>}
      {!items && !error && <p role="status">일정을 불러오는 중…</p>}
      <form onSubmit={async (e) => {
        e.preventDefault(); if (blocked || submission.current || !items?.length) return;
        submission.current = request; setSubmitting(true);
        setError('');
        const changes = Object.fromEntries((items || []).map((item) => [item.id,
          Object.fromEntries(FIELDS.filter(([key]) => (overrides[item.id]?.[key] || '') !== (item[key] || ''))
            .map(([key]) => [key, overrides[item.id][key]]))]).filter(([, patch]) => Object.keys(patch).length));
        const failure = () => { if (activeRequest.current === request) setError('등록하지 못한 일정이 있습니다. 화면의 오류와 수정 값을 확인한 뒤 다시 시도해 주세요.'); };
        try { if (!(await onConfirm(changes))) failure(); }
        catch { failure(); }
        finally {
          if (activeRequest.current === request) { submission.current = null; setSubmitting(false); }
        }
      }}>
        {items?.length > 0 && <div className="confirm-rows">{items.map((item) => {
          const type = TYPES[item.event_type] || '일정';
          const flags = flaggedFields(confirmationReason(item));
          const values = valuesOf(item);
          const open = editAll || Boolean(editingRows[item.id]);
          return <div className="confirm-row" key={item.id}>
            <div className="confirm-row-head">
              <span className="confirm-type">{type}</span>
              <div className="confirm-summary">
                <div className="confirm-when">{summaryParts(values, flags).map((part, i) => part.flagged ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</div>
                <div className="confirm-where">{flags.has('location') ? <mark>{values.location || '장소 정보 없음'}</mark> : values.location || '장소 정보 없음'}</div>
              </div>
              {!editAll && <button type="button" className="confirm-edit" disabled={blocked} aria-expanded={open} aria-controls={rowId(item)}
                aria-label={`${type} 일정 ${open ? '접기' : '고치기'}`} onClick={() => toggleRow(item)}>{open ? '접기' : '고치기'}</button>}
            </div>
            {open && <fieldset id={rowId(item)} disabled={blocked}>
              <legend className="sr-only">{type} · {item.title}</legend>
              <div className="confirm-fields">{FIELDS.map(([key, label, inputType]) => <label key={key} className={key === 'location' ? 'wide' : undefined}>
                {label}<input type={inputType} className={flags.has(key) ? 'flagged' : undefined} value={overrides[item.id]?.[key] || ''} maxLength={key === 'location' ? 255 : undefined}
                  onChange={(e) => setOverrides((prev) => ({ ...prev, [item.id]: { ...prev[item.id], [key]: e.target.value } }))} />
              </label>)}</div>
            </fieldset>}
          </div>;
        })}</div>}
        {items && <div className="confirm-source">
          {highlighted.length > 0 ? <details>
            <summary>공지에서 날짜가 나온 줄 <span className="confirm-count">{highlighted.length}</span></summary>
            <div className="confirm-lines">{highlighted.map((line) => <p key={line.index}>{line.parts.map((part, i) => part.match ? <mark key={i}>{part.text}</mark> : part.text)}</p>)}</div>
          </details> : <p className="confirm-source-empty">공지 글에서 날짜 줄을 찾지 못했어요. 원문 공지에서 확인해 주세요.</p>}
          {sourceUrl && <a className="confirm-source-link" href={sourceUrl} target="_blank" rel="noreferrer">원문 공지 열기<span aria-hidden="true"> ↗</span></a>}
        </div>}
        <p id={descriptionId} className="confirm-note">{editAll ? '날짜·시각·장소를 고칠 수 있어요. ' : ''}고친 내용은 내 캘린더에만 적용돼요.{!request.interview && ' 면접 일정은 상세 화면에서 따로 추가할 수 있어요.'}</p>
        {error && <p role="alert" className="confirm-error">{error}</p>}
        <div className="confirm-actions">
          <button type="button" disabled={blocked} onClick={() => { if (!submission.current) onCancel(); }}>취소</button>
          <button type="submit" className="confirm-primary" disabled={blocked || !items?.length}>{blocked ? '저장 중…' : editAll ? '수정 내용 저장' : changed ? '고친 내용으로 등록' : '맞아요, 등록'}</button>
        </div>
      </form>
    </section>
  </div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
