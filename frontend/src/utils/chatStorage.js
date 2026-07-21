// Sessions ab har logged-in user (email) ke hisaab se alag store honge
function getScopeKey() {
  const email = localStorage.getItem("ikb-user-email");
  const industryCode = localStorage.getItem("ikb-industry-code");
  return email || industryCode || "guest";
}

function sessionsKey() {
  return `ikb-chat-sessions_${getScopeKey()}`;
}

function activeSessionKey() {
  return `ikb-active-session_${getScopeKey()}`;
}

export function createSession() {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function deriveTitle(text) {
  if (!text) return "New Chat";
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 42 ? clean.slice(0, 42) + "…" : clean;
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(sessionsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(sessionsKey(), JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

export function loadActiveSessionId() {
  try {
    return localStorage.getItem(activeSessionKey());
  } catch {
    return null;
  }
}

export function saveActiveSessionId(id) {
  try {
    localStorage.setItem(activeSessionKey(), id);
  } catch {
    // ignore
  }
}