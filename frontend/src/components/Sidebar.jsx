import Truncate from "./Truncate";

export default function Sidebar({
  view, setView, theme, toggleTheme, backendOnline, flagCount,
  sessions, activeSessionId, onNewChat, onSwitchSession, onDeleteSession,
  industryName, onLogout,
}) {
  const navItems = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "graph", label: "Graph", icon: "🕸" },
    { id: "documents", label: "Documents", icon: "📄" },
    { id: "flagged", label: "Flagged", icon: "⚠" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">{industryName || "Industrial Nexus"}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? "active" : ""}`}
            onClick={() => setView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === "flagged" && flagCount > 0 && (
              <span className="nav-badge">{flagCount}</span>
            )}
          </button>
        ))}
      </nav>

      {view === "chat" && (
        <div className="chat-sessions">
          <button className="new-chat-btn" onClick={onNewChat}>
            <span className="new-chat-icon">+</span>
            <span>New Chat</span>
          </button>

          <div className="session-list">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${s.id === activeSessionId ? "active" : ""}`}
                onClick={() => onSwitchSession(s.id)}
              >
                <Truncate text={s.title} maxLength={26} className="session-title" />
                <button
                  className="session-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                  aria-label="Delete chat"
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-bottom">
        <button className="theme-toggle" onClick={toggleTheme}>
          <span>{theme === "light" ? "🌙" : "☀️"}</span>
          <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
        <button className="theme-toggle" onClick={onLogout}>
          <span>🚪</span>
          <span>Logout</span>
        </button>
        <div className="backend-status">
          <span className={`status-dot ${backendOnline === false ? "offline" : ""}`} />
          <span>{backendOnline === false ? "Backend offline" : "Backend online"}</span>
        </div>
      </div>
    </aside>
  );
}