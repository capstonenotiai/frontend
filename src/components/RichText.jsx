/**
 * 문단 배열을 렌더링. **굵게** 표기만 <b> 로 바꾼다.
 * HTML 문자열을 그대로 넣지 않으므로(dangerouslySetInnerHTML 미사용) LLM 응답을 안전하게 표시할 수 있다.
 */
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={index}>{part.slice(2, -2)}</b> : part,
  );
}

export default function RichText({ paragraphs }) {
  return paragraphs.map((paragraph, index) => <p key={index}>{renderInline(paragraph)}</p>);
}
