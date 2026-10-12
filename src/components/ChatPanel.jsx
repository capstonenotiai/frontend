import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAT_GREETING } from '../utils/planner';
import * as plannerService from '../services/plannerService';
import RichText from './RichText';
import { CloseIcon } from './icons';
import '../styles/chat.css';

/** AppLayout에 계속 마운트해 화면 이동·창 닫기에도 대화를 보관한다. */
export default function ChatPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [plannerService.createMessage('assistant', CHAT_GREETING)]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const fabRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending, open]);
  const close = () => { setOpen(false); fabRef.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); fabRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const requestReply = async (text, history) => {
    if (busy.current) return;
    busy.current = true; setSending(true); setError(null);
    try {
      const reply = await plannerService.sendMessage({ message: text, history });
      if (mounted.current) setMessages((current) => [...current, reply]);
    } catch (err) {
      if (mounted.current) {
        if (err.status === 401) { setOpen(false); navigate('/', { replace: true }); }
        else setError({ text, history, message: err.status === 500 ? 'AI 플래너 설정이 아직 끝나지 않았어요.' : '답변을 받지 못했어요. 잠시 후 다시 보내 주세요.' });
      }
    } finally {
      busy.current = false;
      if (mounted.current) { setSending(false); if (panelRef.current && !panelRef.current.hidden) inputRef.current?.focus(); }
    }
  };
  const submit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy.current) return;
    const history = messages;
    setMessages((current) => [...current, plannerService.createMessage('user', text)]);
    setInput('');
    requestReply(text, history);
  };
  return <div className="app-chat">
    <section className="chat-window" id="app-chat-window" ref={panelRef} hidden={!open} role="dialog" aria-labelledby="app-chat-title">
      <header className="chat-header"><h2 id="app-chat-title">내 일정에 대해 묻기</h2><button type="button" aria-label="채팅 닫기" onClick={close}><CloseIcon /></button></header>
      <div className="chat-messages" ref={listRef} role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((message) => <div key={message.id} className={`chat-message ${message.role}`}><span className="sr-only">{message.role === 'user' ? '나' : 'AI'}: </span><RichText paragraphs={message.content} /></div>)}
        {sending && <div className="chat-wait" role="status"><span className="sr-only">답변을 작성하고 있어요.</span><svg width="40" height="16" viewBox="0 0 40 16" aria-hidden="true">{[8, 20, 32].map((x, index) => <circle key={x} cx={x} cy="8" r="2" fill="currentColor" style={{ animationDelay: `${index * 150}ms` }} />)}</svg></div>}
      </div>
      {error && <div className="chat-error" role="alert"><span>{error.message}</span><button type="button" disabled={sending} onClick={() => requestReply(error.text, error.history)}>다시 보내기</button></div>}
      <form className="chat-form" onSubmit={submit}><input ref={inputRef} type="text" maxLength={3000} value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} placeholder="다가오는 일정에 대해 물어보세요" aria-label="채팅 메시지" /><button type="submit" disabled={sending || !input.trim()}>보내기</button></form>
    </section>
    <button type="button" className="chat-fab" ref={fabRef} aria-label={open ? '채팅 닫기' : '채팅 열기'} aria-expanded={open} aria-controls="app-chat-window" onClick={() => open ? close() : setOpen(true)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 10h8m-8 4h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  </div>;
}
