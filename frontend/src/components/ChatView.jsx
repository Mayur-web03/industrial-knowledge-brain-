import { useEffect, useRef, useState } from "react";
import Truncate from "./Truncate";
import { uploadFiles } from "../api";

const SUGGESTIONS = [
  "why did pump 101 show vibration issues",
  "what does OISD-105 require for boiler inspection",
  "is pump 104 connected to the boiler-3 incident",
];

const RCA_LABELS = ["SYMPTOM", "CONTRIBUTING FACTOR", "ROOT CAUSE", "RECOMMENDATION"];
const CONNECTION_LABELS = ["CURRENT FINDING", "HISTORICAL CONTEXT"];

function parseStructuredAnswer(text) {
  if (!text) return null;

  for (const labelSet of [RCA_LABELS, CONNECTION_LABELS]) {
    const pattern = new RegExp(`(${labelSet.join("|")}):`, "g");
    const matches = [...text.matchAll(pattern)];
    if (matches.length < 2) continue;

    const sections = [];
    for (let i = 0; i < matches.length; i++) {
      const label = matches[i][1];
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const content = text.slice(start, end).trim();
      if (content) sections.push({ label, content });
    }
    if (sections.length > 0) {
      return { sections, kind: labelSet === RCA_LABELS ? "rca" : "connection" };
    }
  }
  return null;
}

function confidenceTier(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function resolveAgentLabel(message, structured) {
  if (message.compliance_gaps && message.compliance_gaps.length > 0) {
    return { name: "Compliance Agent", icon: "⚖" };
  }
  if (structured?.kind === "rca") {
    return { name: "RCA Agent", icon: "🔎" };
  }
  if (structured?.kind === "connection") {
    return { name: "Cross-Reference Agent", icon: "🔗" };
  }
  return { name: "Maintenance Intelligence Agent", icon: "🛠" };
}

function formatSharedContext(context) {
  const items = Array.isArray(context) ? context : context ? [context] : [];
  return items.join(", ");
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function StructuredBlock({ sections }) {
  return (
    <div className="rca-block">
      {sections.map((s, i) => (
        <div className="rca-section" key={i}>
          <div className={`rca-label rca-label-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
            {s.label}
          </div>
          <div className="rca-content">{s.content}</div>
        </div>
      ))}
    </div>
  );
}

function ComplianceGapCard({ gaps }) {
  return (
    <div className="compliance-card hazard-corner">
      <div className="compliance-card-header">⚠ Compliance Gap Detected</div>
      {gaps.map((g, i) => (
        <div className="compliance-item" key={i}>
          <div className="compliance-req">
            <span className="compliance-tag">{g.procedure}</span>
            <span className="compliance-arrow">→</span>
            <span className="compliance-tag">{g.equipment}</span>
          </div>
          <div className="compliance-requirement">{g.requirement}</div>
          <div className="compliance-gap">{g.gap}</div>
        </div>
      ))}
    </div>
  );
}

function ConfidenceBadge({ score }) {
  if (score === undefined || score === null) return null;
  const tier = confidenceTier(score);
  return (
    <span className={`confidence-badge confidence-${tier}`} title="Retrieval-derived confidence, not a calibrated probability">
      {score}% confidence
    </span>
  );
}

export default function ChatView({
  messages, input, setInput, loading, flags, flagsExpanded, setFlagsExpanded,
  onDismissFlags, streamRef, handleSend, handleSubmit, setView, sessionTitle,
}) {
  const inputRef = useRef(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [micSupported, setMicSupported] = useState(true);

  const [attachOpen, setAttachOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);
  const attachMenuRef = useRef(null);

  const [copiedIdx, setCopiedIdx] = useState(null);

  // ---- Type-to-focus ----
  useEffect(() => {
    function handleGlobalKeydown(e) {
      const active = document.activeElement;
      const isTypingElsewhere =
        active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);

      if (isTypingElsewhere || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setMicSupported(!!SpeechRecognition);
  }, []);

  // ---- Close attach menu on outside click ----
  useEffect(() => {
    function handleClickOutside(e) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setAttachOpen(false);
      }
    }
    if (attachOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [attachOpen]);

  function toggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function handleAttachFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setAttachOpen(false);

    for (const file of files) {
      setUploadStatus({ filename: file.name, status: "uploading" });
      try {
        await uploadFiles([file]);
        setUploadStatus({ filename: file.name, status: "success" });
      } catch (err) {
        setUploadStatus({ filename: file.name, status: "error" });
      }
      setTimeout(() => setUploadStatus(null), 3500);
    }
  }

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    });
  }

  // ---- Report generation ----
  function handleExportReport() {
    if (messages.length === 0) return;

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      alert("Please allow pop-ups for this site to export the report.");
      return;
    }

    const dateStr = new Date().toLocaleString("en-IN", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const qaBlocks = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "user") {
        const next = messages[i + 1];
        const answer = next && next.role === "assistant" ? next : null;
        qaBlocks.push({ question: m.text, answer });
      }
    }

    const bodyHtml = qaBlocks.map((block, idx) => {
      const sources = block.answer?.sources ? [...new Set(block.answer.sources.filter(Boolean))] : [];
      const gaps = block.answer?.compliance_gaps || [];
      return `
        <div class="qa-block">
          <div class="qa-question"><span class="qa-label">Q${idx + 1}.</span> ${escapeHtml(block.question)}</div>
          ${block.answer ? `
            <div class="qa-answer">${escapeHtml(block.answer.text || "").replace(/\n/g, "<br/>")}</div>
            ${block.answer.confidence !== undefined && block.answer.confidence !== null
              ? `<div class="qa-meta">Confidence: ${block.answer.confidence}%</div>` : ""}
            ${sources.length > 0
              ? `<div class="qa-sources">Sources: ${sources.map(escapeHtml).join(", ")}</div>` : ""}
            ${gaps.length > 0 ? `
              <div class="qa-gaps">
                <strong>Compliance Gaps</strong>
                ${gaps.map(g => `<div class="gap-item">${escapeHtml(g.procedure)} → ${escapeHtml(g.equipment)}: ${escapeHtml(g.gap)}</div>`).join("")}
              </div>
            ` : ""}
          ` : `<div class="qa-answer qa-pending">No response recorded.</div>`}
        </div>
      `;
    }).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(sessionTitle || "Investigation Report")}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Georgia, "Times New Roman", serif;
            color: #1a1a1a;
            max-width: 780px;
            margin: 0 auto;
            padding: 50px 40px;
            line-height: 1.6;
          }
          .report-header {
            border-bottom: 3px solid #FF6A1A;
            padding-bottom: 18px;
            margin-bottom: 30px;
          }
          .report-brand {
            font-family: Arial, sans-serif;
            font-size: 12px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #FF6A1A;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .report-title { font-size: 24px; font-weight: 700; margin: 0 0 8px; }
          .report-meta { font-family: Arial, sans-serif; font-size: 12px; color: #555; }
          .qa-block {
            margin-bottom: 26px;
            padding-bottom: 20px;
            border-bottom: 1px solid #ddd;
            page-break-inside: avoid;
          }
          .qa-label { color: #FF6A1A; font-weight: 700; }
          .qa-question { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
          .qa-answer { font-size: 14px; color: #222; margin-bottom: 8px; white-space: pre-wrap; }
          .qa-meta, .qa-sources { font-family: Arial, sans-serif; font-size: 11px; color: #666; margin-bottom: 4px; }
          .qa-gaps {
            margin-top: 8px;
            padding: 10px 12px;
            background: #fdf2f2;
            border-left: 3px solid #C9302C;
            font-family: Arial, sans-serif;
            font-size: 12px;
          }
          .gap-item { margin-top: 4px; }
          .report-footer {
            margin-top: 40px;
            font-family: Arial, sans-serif;
            font-size: 10.5px;
            color: #999;
            text-align: center;
          }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="report-brand">Industrial Nexus</div>
          <h1 class="report-title">${escapeHtml(sessionTitle || "Investigation Report")}</h1>
          <div class="report-meta">Generated on ${dateStr} · ${qaBlocks.length} question${qaBlocks.length !== 1 ? "s" : ""}</div>
        </div>
        ${bodyHtml || '<p style="color:#888;">No conversation recorded in this session.</p>'}
        <div class="report-footer">Generated by Industrial Nexus — Confidential</div>
      </body>
      </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 400);
  }

  return (
    <div className="view chat-view">
      {flags.length > 0 && (
        <div className="flag-card">
          <div className="flag-card-header">
            <div className="flag-card-header-clickable" onClick={() => setFlagsExpanded((v) => !v)}>
              <span>⚠ Flagged Equipment</span>
              <span className="flag-count">{flags.length}</span>
            </div>
            <button
              className="flag-dismiss-btn"
              onClick={onDismissFlags}
              aria-label="Dismiss flagged equipment"
              title="Dismiss"
            >
              ×
            </button>
          </div>
          <div className={`flag-list ${flagsExpanded ? "" : "collapsed"}`}>
            {flags.map((f, i) => (
              <div className={`flag-item ${f.severity === "critical" ? "critical" : ""}`} key={i}>
                <span className="flag-equipment">{f.equipment}</span>
                <span className="flag-arrow">→</span>
                <span className="flag-incident">{f.related_incident}</span>
                <Truncate
                  text={formatSharedContext(f.shared_context)}
                  maxLength={38}
                  className="flag-context"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="chat-toolbar">
          <button className="export-report-btn" onClick={handleExportReport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Export Report
          </button>
        </div>
      )}

      <div className="chat-window" ref={streamRef}>
        {messages.length === 0 && (
          <div className="welcome">
            <h1>What do you want to know?</h1>
            <p>Ask about equipment, maintenance history, or safety procedures.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="messages">
          {messages.map((m, i) => {
            const uniqueSources = m.sources
              ? [...new Set(m.sources.filter(Boolean))]
              : [];

            const isAssistant = m.role === "assistant" && !m.error;
            const structured = isAssistant ? parseStructuredAnswer(m.text) : null;
            const hasComplianceGaps = isAssistant && m.compliance_gaps && m.compliance_gaps.length > 0;
            const agent = isAssistant ? resolveAgentLabel(m, structured) : null;

            return (
              <div className={`message ${m.role}`} key={i}>
                {agent && (
                  <div className="agent-badge">
                    <span className="agent-icon">{agent.icon}</span>
                    {agent.name}
                  </div>
                )}
                <div className={`bubble ${m.error ? "error" : ""}`}>
                  {structured ? <StructuredBlock sections={structured.sections} /> : m.text}
                </div>
                {hasComplianceGaps && <ComplianceGapCard gaps={m.compliance_gaps} />}
                {isAssistant && m.confidence !== undefined && (
                  <ConfidenceBadge score={m.confidence} />
                )}
                {uniqueSources.length > 0 && (
                  <div className="sources">
                    {uniqueSources.map((s, idx) => (
                      <Truncate
                        key={`${s}-${idx}`}
                        text={s}
                        maxLength={22}
                        className="source-tag"
                      />
                    ))}
                  </div>
                )}
                {isAssistant && (
                  <button
                    className="copy-msg-btn"
                    onClick={() => handleCopy(m.text, i)}
                    aria-label="Copy answer"
                    title="Copy answer"
                  >
                    {copiedIdx === i ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="message assistant">
              <div className="bubble typing">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          )}
        </div>
      </div>

      {uploadStatus && (
        <div className={`upload-toast upload-toast-${uploadStatus.status}`}>
          {uploadStatus.status === "uploading" && <span className="upload-spinner" />}
          {uploadStatus.status === "success" && <span>✓</span>}
          {uploadStatus.status === "error" && <span>✕</span>}
          <span className="upload-toast-text">
            {uploadStatus.status === "uploading" && `Uploading ${uploadStatus.filename}...`}
            {uploadStatus.status === "success" && `${uploadStatus.filename} added to knowledge base`}
            {uploadStatus.status === "error" && `Failed to upload ${uploadStatus.filename}`}
          </span>
        </div>
      )}

      <form className="input-bar" onSubmit={handleSubmit}>
        <div className="attach-wrap" ref={attachMenuRef}>
          <button
            type="button"
            className="attach-btn"
            onClick={() => setAttachOpen((v) => !v)}
            disabled={loading}
            aria-label="Attach document"
            title="Attach document"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {attachOpen && (
            <div className="attach-menu">
              <button
                type="button"
                className="attach-menu-item"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload document
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              handleAttachFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="input-field-wrap">
          <input
            ref={inputRef}
            type="text"
            placeholder={listening ? "Listening..." : "Ask a question..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          {micSupported && (
            <button
              type="button"
              className={`mic-btn-inline ${listening ? "listening" : ""}`}
              onClick={toggleMic}
              disabled={loading}
              aria-label={listening ? "Stop listening" : "Start voice input"}
              title={listening ? "Listening… click to stop" : "Voice input"}
            >
              {listening ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          )}
        </div>
        <button type="submit" disabled={loading || !input.trim()} aria-label="Send">
          →
        </button>
      </form>
    </div>
  );
}