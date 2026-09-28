/** 설정 한 줄 (.settings-row) */
export default function SettingsRow({ name, sub, children }) {
  return (
    <div className="settings-row">
      <div className="sr-left">
        <div className="sr-name">{name}</div>
        {sub && <div className="sr-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}
