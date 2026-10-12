import './events/events.css';

export default function UndoToast({ toast, busy, onUndo }) {
  if (!toast) return null;
  return <div className="undo-toast" role="status">
    <span>{toast.message}</span>
    {toast.undo && <button type="button" disabled={busy} onClick={onUndo}>되돌리기</button>}
  </div>;
}
