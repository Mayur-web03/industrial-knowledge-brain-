import { useEffect, useState } from "react";
import { fetchDocuments } from "../api";

export default function Sidebar({
  view,
  setView,
  theme,
  toggleTheme,
  backendOnline,
  flagCount = 0,
  sessions = [],
  activeSessionId,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  industryName,
  onLogout,
}) {
  const [docFlagCount, setDocFlagCount] = useState(0);

  // Error ya flagged status waale documents count karne ke liye
  useEffect(() => {
    async function loadDocFlags() {
      try {
        const data = await fetchDocuments();
        const count = (data.documents || []).filter(
          (d) => d.status === "error" || d.flagged === true
        ).length;
        setDocFlagCount(count);
      } catch (err) {
        console.error("Failed to fetch document flags:", err);
      }
    }
    loadDocFlags();
  }, [view]); // Jab bhi tab switch ho, count refresh hoga

  const totalFlaggedCount = flagCount + docFlagCount;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand flex-center">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">
            {industryName ? `${industryName} Knowledge` : "Industrial IKB"}
          </span>
        </div>
        <div
          className={`status-indicator ${
            backendOnline ? "online" : backendOnline === false ? "offline" : ""
          }`}
          title={
            backendOnline
              ? "Backend Online"
              : backendOnline === false
              ? "Backend Offline"
              : "Checking Backend..."
          }
        />
      </div>

      <nav className="nav-menu">
        <button
          className={`nav-item ${view === "chat" ? "active" : ""}`}
          onClick={() => setView("chat")}
        >
          <span className="nav-icon">💬</span>
          <span>Chat</span>
        </button>

        <button
          className={`nav-item ${view === "documents" ? "active" : ""}`}
          onClick={() => setView("documents")}
        >
          <span className="nav-icon">📁</span>
          <span>Documents</span>
        </button>

        <button
          className={`nav-item ${view === "graph" ? "active" : ""}`}
          onClick={() => setView("graph")}
        >
          <span className="nav-icon">🕸</span>
          <span>Graph</span>
        </button>

        <button
          className={`nav-item ${view === "flagged" ? "active" : ""}`}
          onClick={() => setView("flagged")}
        >
          <span className="nav-icon">⚠</span>
          <span>Flagged</span>
          {totalFlaggedCount > 0 && (
            <span className="nav-badge">{totalFlaggedCount}</span>
          )}
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-header flex-between">
          <span>Recent Chats</span>
          <button
            className="icon-btn"
            onClick={onNewChat}
            title="New Chat"
          >
            ➕
          </button>
        </div>

        <div className="session-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${
                s.id === activeSessionId && view === "chat" ? "active" : ""
              }`}
              onClick={() => onSwitchSession(s.id)}
            >
              <span className="session-title">{s.title || "New Chat"}</span>
              <button
                className="session-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(s.id);
                }}
                title="Delete Chat"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title="Toggle Theme"
        >
          {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </button>

        {onLogout && (
          <button
            className="logout-btn"
            onClick={onLogout}
            title="Log Out"
          >
            🚪 Logout
          </button>
        )}
      </div>
    </aside>
  );
}