import { useState } from "react";

export default function FlaggedView({ flags }) {
  const [selected, setSelected] = useState(null);

  const hasFlags = Array.isArray(flags) && flags.length > 0;

  return (
    <div className="view documents-view">
      <div className="view-header">
        <h2>Flagged Documents</h2>
        <p className="view-subtitle">
          Equipment and incidents flagged for review across your knowledge base.
        </p>
      </div>

      {!hasFlags ? (
        <div className="loading-state">No flagged items right now 🎉</div>
      ) : (
        <div className="graph-body">
          <div className="doc-list doc-list-lg" style={{ flex: 1 }}>
            {flags.map((f, i) => {
              const isSelected =
                selected &&
                selected.equipment === f.equipment &&
                selected.related_incident === f.related_incident;
              return (
                <div
                  className="doc-item"
                  key={`${f.equipment}-${f.related_incident}-${i}`}
                  onClick={() => setSelected(f)}
                  style={{
                    cursor: "pointer",
                    borderLeftColor: isSelected ? "var(--accent)" : "var(--error)",
                  }}
                >
                  <span className="doc-name">{f.equipment}</span>
                  <span className="doc-date">{f.related_incident}</span>
                  <span className="doc-status error">flagged</span>
                </div>
              );
            })}
          </div>

          {selected && (
            <div className="graph-detail-panel">
              <div className="graph-detail-title">{selected.equipment}</div>
              <div className="graph-detail-type" style={{ color: "var(--error)" }}>
                Incident: {selected.related_incident}
              </div>

              {Array.isArray(selected.shared_context) &&
                selected.shared_context.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      className="plate-label"
                      style={{ fontSize: "10.5px", color: "var(--text-muted)", marginBottom: 6 }}
                    >
                      Related context
                    </div>
                    {selected.shared_context.map((ctx, idx) => (
                      <div
                        key={idx}
                        className="graph-detail-flag"
                        style={{ marginBottom: 6 }}
                      >
                        • {ctx}
                      </div>
                    ))}
                  </div>
                )}

              {selected.reason && (
                <div className="graph-detail-flag" style={{ marginTop: 8 }}>
                  {selected.reason}
                </div>
              )}

              <button
                className="graph-detail-close"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}