/**
 * 작은 뱃지 (.pill)
 * tone: 'red' | 'amber' | 'green' | 'blue' | 'gray' | 'new'
 */
export default function Badge({ tone = 'gray', children, style, className = '' }) {
  return (
    <span className={`pill ${tone} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
