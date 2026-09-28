/** 공통 카드 (.card / .card-header / .card-body) */
export default function Card({ title, icon, titleExtra, headerRight, children, className = '', bodyClassName = '', bodyStyle, style }) {
  const hasHeader = title || headerRight;
  return (
    <div className={`card ${className}`.trim()} style={style}>
      {hasHeader && (
        <div className="card-header">
          <div className="card-title">
            {icon}
            {title}
            {titleExtra}
          </div>
          {headerRight}
        </div>
      )}
      <div className={`card-body ${bodyClassName}`.trim()} style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}
