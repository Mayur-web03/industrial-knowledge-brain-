import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { askBrain, checkHealth, fetchFlags } from "./api";
import {
  loadSessions,
  saveSessions,
  loadActiveSessionId,
  saveActiveSessionId,
  createSession,
  deriveTitle,
} from "./utils/chatStorage";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import DocumentsView from "./components/DocumentsView";
import GraphView from "./components/GraphView";
import FlaggedView from "./components/FlaggedView";
import AuthGate from "./components/AuthGate";
import Home from "./components/Home";

const FLAGS_DISMISSED_KEY = "ikb-flags-dismissed-ids";

function flagKey(f) {
  return `${f.equipment}|${f.related_incident}`;
}

function MainApp({ token, industryName, onLogout }) {
  const [view, setView] = useState("chat");
  const [theme, setTheme] = useState(() => localStorage.getItem("ikb-theme") || "dark");

  const [sessions, setSessions] = useState(() => {
    const loaded = loadSessions();
    return loaded.length > 0 ? loaded : [createSession()];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = loadActiveSessionId();
    const loaded = loadSessions();
    if (saved && loaded.some((s) => s.id === saved)) return saved;
    return loaded.length > 0 ? loaded[0].id : null;
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [flags, setFlags] = useState([]);
  const [flagsExpanded, setFlagsExpanded] = useState(false);

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(FLAGS_DISMISSED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  const streamRef = useRef(null);

  useEffect(() => {
    if (sessions.length === 0) {
      const fresh = createSession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      return;
    }
    if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) saveActiveSessionId(activeSessionId);
  }, [activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const messages = activeSession ? activeSession.messages : [];

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ikb-theme", theme);
  }, [theme]);

  const updateFlagsSafely = useCallback((rawFlags) => {
    const targetFlags = rawFlags?.flags || rawFlags || [];
    if (Array.isArray(targetFlags)) {
      const cleaned = targetFlags.map((f) => ({
        ...f,
        shared_context: Array.isArray(f.shared_context)
          ? f.shared_context
          : f.shared_context
          ? [f.shared_context]
          : [],
      }));
      setFlags(cleaned);
    } else {
      setFlags([]);
    }
  }, []);

  useEffect(() => {
    checkHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));

    fetchFlags()
      .then(updateFlagsSafely)
      .catch((err) => {
        if (err.message?.includes("401")) onLogout();
        setFlags([]);
      });
  }, [updateFlagsSafely, onLogout]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const appendMessageToSession = useCallback((sessionId, message) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const updatedMessages = [...s.messages, message];
        const title =
          s.title === "New Chat" && message.role === "user"
            ? deriveTitle(message.text)
            : s.title;
        return { ...s, messages: updatedMessages, title, updatedAt: Date.now() };
      })
    );
  }, []);

  const handleSend = useCallback(
    async (query) => {
      if (!query.trim() || loading || !activeSessionId) return;
      const sessionId = activeSessionId;

      appendMessageToSession(sessionId, { role: "user", text: query });
      setInput("");
      setLoading(true);

      try {
        const data = await askBrain(query);
        appendMessageToSession(sessionId, {
          role: "assistant",
          text: data.answer,
          sources: data.sources,
          confidence: data.confidence,
          compliance_gaps: data.compliance_gaps,
        });
        setBackendOnline(true);

        try {
          const freshFlags = await fetchFlags();
          updateFlagsSafely(freshFlags);
        } catch {
          // silently ignore
        }
      } catch (err) {
        appendMessageToSession(sessionId, {
          role: "assistant",
          error: true,
          text: `Couldn't reach the backend (${err.message}). Make sure uvicorn is running on port 8000.`,
        });
        setBackendOnline(false);
      } finally {
        setLoading(false);
      }
    },
    [loading, activeSessionId, appendMessageToSession, updateFlagsSafely]
  );

  function handleSubmit(e) {
    e.preventDefault();
    handleSend(input);
  }

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  function handleNewChat() {
    const fresh = createSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setInput("");
    setView("chat");
  }

  function handleSwitchSession(id) {
    setActiveSessionId(id);
    setInput("");
    setView("chat");
  }

  function handleDeleteSession(id) {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = createSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSessionId) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  }

  function handleDismissFlags() {
    const ids = new Set(flags.map(flagKey));
    setDismissedIds(ids);
    try {
      sessionStorage.setItem(FLAGS_DISMISSED_KEY, JSON.stringify([...ids]));
    } catch {
      // non-fatal
    }
  }

  const visibleFlags = flags.filter((f) => !dismissedIds.has(flagKey(f)));

  return (
    <div className="app">
      <Sidebar
        view={view}
        setView={setView}
        theme={theme}
        toggleTheme={toggleTheme}
        backendOnline={backendOnline}
        flagCount={flags.length}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSwitchSession={handleSwitchSession}
        onDeleteSession={handleDeleteSession}
        industryName={industryName}
        onLogout={onLogout}
      />

      <main className="main-content">
        {view === "chat" && (
          <ChatView
            messages={messages}
            input={input}
            setInput={setInput}
            loading={loading}
            flags={visibleFlags}
            flagsExpanded={flagsExpanded}
            setFlagsExpanded={setFlagsExpanded}
            onDismissFlags={handleDismissFlags}
            streamRef={streamRef}
            handleSend={handleSend}
            handleSubmit={handleSubmit}
            setView={setView}
            sessionTitle={activeSession?.title}
          />
        )}
        {view === "documents" && <DocumentsView />}
        {view === "graph" && <GraphView />}
        {view === "flagged" && <FlaggedView flags={flags} />}
      </main>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem("ikb-token"));
  const [industryName, setIndustryName] = useState(
    () => localStorage.getItem("ikb-industry-name") || ""
  );

  const handleAuthSuccess = useCallback(
    (data) => {
      localStorage.setItem("ikb-token", data.token);
      localStorage.setItem("ikb-industry-code", data.industry_code);
      localStorage.setItem("ikb-industry-name", data.industry_name || "");
      // Yeh line critical hai per-user chat isolation ke liye:
      localStorage.setItem("ikb-user-email", data.email || data.industry_code || "guest");
      setToken(data.token);
      setIndustryName(data.industry_name || "");
      navigate("/chat");
    },
    [navigate]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("ikb-token");
    localStorage.removeItem("ikb-industry-code");
    localStorage.removeItem("ikb-industry-name");
    localStorage.removeItem("ikb-user-email");
    setToken(null);
    setIndustryName("");
    navigate("/");
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Home onGetStarted={() => navigate("/auth")} />} />
      <Route
        path="/auth"
        element={
          <AuthGate onAuthSuccess={handleAuthSuccess} onBack={() => navigate("/")} />
        }
      />
      <Route
        path="/chat"
        element={
          token ? (
            <MainApp token={token} industryName={industryName} onLogout={handleLogout} />
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}