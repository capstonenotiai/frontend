import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function DeleteAccountDialog({ triggerRef, onCancel, onDelete }) {
  const cancel = useRef(null), panel = useRef(null), lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    cancel.current?.focus();
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
      if (event.key === 'Tab') {
        const controls = [...panel.current.querySelectorAll('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); triggerRef.current?.focus(); };
  }, [onCancel, triggerRef]);
  const content = <div className="account-delete-backdrop"><section ref={panel} className="account-delete-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy}>
    <h2 id={titleId}>계정을 삭제할까요?</h2>
    <p id={descriptionId}>내 프로필, 설정, 저장·등록 상태, 알림, 신고와 의견이 지워지고 되돌릴 수 없어요. Google 캘린더에 이미 들어간 일정은 지워지지 않으니 필요하면 Google 캘린더에서 직접 지워 주세요.</p>
    {error && <p className="settings-error" role="alert">{error}</p>}
    <div className="account-delete-actions"><button ref={cancel} type="button" className="settings-button" onClick={onCancel}>취소</button>
      <button type="button" className="settings-button danger" disabled={busy} onClick={async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError('');
        try { await onDelete(); }
        catch { setError('계정을 삭제하지 못했어요. 다시 시도해 주세요.'); }
        finally { lock.current = false; setBusy(false); }
      }}>{busy ? '삭제 중…' : error ? '다시 시도' : '계정 삭제'}</button></div>
  </section></div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
