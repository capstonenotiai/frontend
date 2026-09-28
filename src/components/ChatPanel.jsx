import { useCallback, useEffect, useRef, useState } from 'react';
import { PLANNER_ASSISTANT } from '../config/app';
import * as plannerService from '../services/plannerService';
import Badge from './Badge';
import RichText from './RichText';

/**
 * AI 플래너 대화 패널.
 *  - 메시지 기록(history), 입력, 전송, loading / error 상태
 *  - 모드가 바뀌면 원본처럼 새 모드의 인사 메시지로 대화를 초기화
 *  - 실제 LLM 호출은 하지 않음 → services/plannerService.js (mock / 향후 백엔드)
 */
export default function ChatPanel({ mode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const conversationRef = useRef(0);

  // 모드 변경 → 대화 초기화
  useEffect(() => {
    conversationRef.current += 1;
    const conversationId = conversationRef.current;
    setSending(false);
    setError(null);
    plannerService.getGreeting(mode.id).then((greeting) => {
      if (conversationRef.current === conversationId) setMessages([greeting]);
    });
  }, [mode.id]);

  // 새 메시지가 오면 목록 맨 아래로
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  const requestReply = useCallback(
    async (text, history) => {
      const conversationId = conversationRef.current;
      setSending(true);
      setError(null);
      try {
        const reply = await plannerService.sendMessage({ message: text, modeId: mode.id, history });
        if (conversationRef.current === conversationId) setMessages((current) => [...current, reply]);
      } catch (err) {
        if (conversationRef.current === conversationId) setError({ message: err.message, text, history });
      } finally {
        if (conversationRef.current === conversationId) setSending(false);
      }
    },
    [mode.id],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    const userMessage = plannerService.createMessage('user', text);
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    requestReply(text, history);
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="ai-chat-avatar">{PLANNER_ASSISTANT.avatar}</div>
        <div>
          <div className="ai-chat-name">{PLANNER_ASSISTANT.name}</div>
          <div className="ai-chat-sub">{PLANNER_ASSISTANT.subtitle}</div>
        </div>
        <Badge tone="blue" style={{ marginLeft: 'auto' }}>
          {mode.name}
        </Badge>
      </div>

      <div className="ai-chat-messages" ref={listRef} aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`ai-chat-bubble ${message.role}`}>
            <RichText paragraphs={message.content} />
          </div>
        ))}
        {sending && <div className="ai-chat-bubble loading">AI 플래너가 답변을 작성하고 있어요…</div>}
      </div>

      {error && (
        <div className="ai-chat-error" role="alert">
          {error.message}
          <button type="button" onClick={() => requestReply(error.text, error.history)} disabled={sending}>
            다시 시도
          </button>
        </div>
      )}

      <form className="ai-chat-input-row" onSubmit={handleSubmit}>
        <input
          className="ai-chat-input"
          type="text"
          placeholder="AI 플래너에게 물어보세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="AI 플래너에게 보낼 메시지"
        />
        <button type="submit" className="btn-sm primary" disabled={sending || !input.trim()}>
          전송
        </button>
      </form>
    </div>
  );
}
