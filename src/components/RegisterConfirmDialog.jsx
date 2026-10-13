import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEventDetail } from '../services/eventService';
import { registrationTargets } from '../utils/registration';
import './RegisterConfirmDialog.css';

const FIELDS = [['start_date', '시작일', 'date'], ['end_date', '종료·마감일', 'date'],
  ['start_time', '시작 시각', 'time'], ['end_time', '종료·마감 시각', 'time'], ['location', '장소', 'text']];
const TYPES = { application: '접수', submission: '제출', event: '본행사', interview: '면접' };

export default function RegisterConfirmDialog({ request, busy, onCancel, onConfirm, triggerRef }) {
  const [items, setItems] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const backdrop = useRef(null), panel = useRef(null), title = useRef(null);
  const activeRequest = useRef(request), submission = useRef(null);
  const actions = useRef({ busy, onCancel });
  const titleId = useId(), descriptionId = useId();
  const blocked = busy || submitting;
  useLayoutEffect(() => { actions.current = { busy: blocked, onCancel }; });
  useLayoutEffect(() => {
    const origin = triggerRef?.current || document.activeElement;
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
      if (origin?.isConnected && !origin.matches(':disabled') && !origin.closest('[inert], [hidden], [aria-hidden="true"]')
        && origin.getClientRects().length) {
        origin.focus({ preventScroll: true });
        if (document.activeElement === origin && origin !== document.body) return;
      }
      const fallback = document.querySelector('main, [role="main"]') || document.body;
      if (!fallback.hasAttribute('tabindex')) {
        fallback.setAttribute('tabindex', '-1');
        fallback.addEventListener('blur', () => fallback.removeAttribute('tabindex'), { once: true });
      }
      fallback.focus({ preventScroll: true });
    };
  }, [triggerRef]);
  useLayoutEffect(() => {
    activeRequest.current = request;
    submission.current = null;
    setItems(null); setOverrides({}); setChecked(false); setError(''); setSubmitting(false);
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
      setOverrides(Object.fromEntries(targets.map((e) => [e.id, Object.fromEntries(FIELDS.map(([key]) => [key, e[key] || '']))])));
    }).catch((err) => { if (!cancelled && activeRequest.current === request) setError(err.message); });
    return () => { cancelled = true; };
  }, [request]);

  const content = <div ref={backdrop} className="confirm-backdrop">
    <section ref={panel} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={blocked}>
      <h2 ref={title} id={titleId} tabIndex={-1}>{request.editing ? '내 일정 수정' : '날짜를 한 번 확인해 주세요'}</h2>
      <p id={descriptionId}>{request.editing ? '날짜·시각·장소를 수정할 수 있어요.' : '공지에서 날짜를 한 번 확인해 주세요.'} 수정한 내용은 내 일정에만 적용됩니다.</p>
      {!request.interview && <p>면접은 함께 등록되지 않습니다. 상세 화면에서 별도로 추가할 수 있습니다.</p>}
      {!items && !error && <p role="status">일정을 불러오는 중…</p>}
      <form onSubmit={async (e) => {
        e.preventDefault(); if (blocked || submission.current || !items?.length || (!request.editing && !checked)) return;
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
        {(items || []).map((item) => <fieldset key={item.id} disabled={blocked}>
          <legend>{TYPES[item.event_type] || '일정'} · {item.title}</legend>
          <a href={item.source_url || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!item.source_url) e.preventDefault(); }}>원문 확인</a>
          {item.review_required && <p className="confirm-warning">확인 필요 · {item.review_reason}</p>}
          <div className="confirm-fields">{FIELDS.map(([key, label, type]) => <label key={key}>
            {label}<input type={type} value={overrides[item.id]?.[key] || ''} maxLength={key === 'location' ? 255 : undefined}
              onChange={(e) => setOverrides((prev) => ({ ...prev, [item.id]: { ...prev[item.id], [key]: e.target.value } }))} />
          </label>)}</div>
        </fieldset>)}
        {!request.editing && <label className="confirm-check"><input type="checkbox" checked={checked} disabled={blocked} onChange={(e) => setChecked(e.target.checked)} /> 공지의 날짜를 확인했어요.</label>}
        {error && <p role="alert">{error}</p>}
        <div className="confirm-actions">
          <button type="button" disabled={blocked} onClick={() => { if (!submission.current) onCancel(); }}>취소</button>
          <button type="submit" disabled={blocked || (!request.editing && !checked) || !items?.length}>{blocked ? '저장 중…' : request.editing ? '수정 내용 저장' : '확인하고 등록'}</button>
        </div>
      </form>
    </section>
  </div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
