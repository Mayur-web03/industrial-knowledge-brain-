import { useEffect, useState } from "react";
import { fetchDocuments } from "../api";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function FlaggedView() {
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchDocuments();
        const flaggedDocs = (data.documents || []).filter(
          (d) => d.status === "error" || d.flagged === true
        );
        setFlagged(flaggedDocs);
      } catch (err) {
        console.error("Failed to load flagged docs:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="view documents-view">
      <div className="view-header">
        <h2>Flagged Documents</h2>
        <p className="view-subtitle">
          Documents that failed processing or need review.
        </p>
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : flagged.length === 0 ? (
        <div className="loading-state">No flagged documents 🎉</div>
      ) : (
        <div className="graph-body">
          <div className="doc-list doc-list-lg" style={{ flex: 1 }}>
            {flagged.map((d, i) => (
              <div
                className="doc-item"
                key={`${d.filename}-${i}`}
                onClick={() => setSelected(d)}
                style={{ cursor: "pointer" }}
              >
                <span className="doc-name">{d.filename}</span>
                {d.upload_date && (
                  <span className="doc-date">{formatDate(d.upload_date)}</span>
                )}
                <span className="doc-status error">flagged</span>
              </div>
            ))}
          </div>

          {selected && (
            <div className="graph-detail-panel">
              <div className="graph-detail-title">{selected.filename}</div>
              <div
                className="graph-detail-type"
                style={{ color: "var(--error)" }}
              >
                Status: {selected.status}
              </div>
              <div className="graph-detail-flag">
                {selected.message || "No additional details available."}
              </div>
              {selected.upload_date && (
                <div className="dropzone-hint" style={{ marginTop: 8 }}>
                  Uploaded: {formatDate(selected.upload_date)}
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