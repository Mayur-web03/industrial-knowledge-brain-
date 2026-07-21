import { useRef, useState, useCallback, useEffect } from "react";
// syncGmail ko import list me include kar diya hai
import { uploadFiles, fetchDocuments, deleteDocument, syncGmail } from "../api";

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

export default function DocumentsView() {
  const [docs, setDocs] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deletingFile, setDeletingFile] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await fetchDocuments();
      setDocs(
        (data.documents || []).map((d) => ({
          filename: d.filename,
          status: d.status,
          upload_date: d.upload_date,
        }))
      );
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // API utility ka use karke documents load ho rhe hain
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleGmailSync = async () => {
    setSyncing(true);
    try {
      await syncGmail();
      alert("Gmail synced successfully!");
      // Document list refresh karke naye synced docs fetch karo
      await loadDocuments();
    } catch (err) {
      console.error("Sync error:", err);
      alert("Gmail sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const pending = files.map((f) => ({ filename: f.name, status: "uploading" }));
    setDocs((prev) => [...pending, ...prev]);

    try {
      const data = await uploadFiles(files);
      setDocs((prev) => {
        const withoutPending = prev.filter(
          (d) => !pending.some((p) => p.filename === d.filename && d.status === "uploading")
        );
        const resolved = data.results.map((r) => ({
          filename: r.filename,
          status: r.status,
          message: r.message,
          upload_date: new Date().toISOString(),
        }));
        return [...resolved, ...withoutPending];
      });
    } catch (err) {
      setDocs((prev) => {
        const withoutPending = prev.filter(
          (d) => !pending.some((p) => p.filename === d.filename && d.status === "uploading")
        );
        const failed = files.map((f) => ({
          filename: f.name,
          status: "error",
          message: err.message,
          upload_date: new Date().toISOString(),
        }));
        return [...failed, ...withoutPending];
      });
    }
  }, []);

  const handleDelete = useCallback(async (filename) => {
    const confirmed = window.confirm(`Delete "${filename}"? Ye knowledge graph se bhi remove ho jayega.`);
    if (!confirmed) return;
    setDeletingFile(filename);
    try {
      await deleteDocument(filename);
      setDocs((prev) => prev.filter((d) => d.filename !== filename));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingFile(null);
    }
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="view documents-view">
      <div className="view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Documents</h2>
          <p className="view-subtitle">Add manuals, procedures, or reports to the knowledge base.</p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={handleGmailSync} 
          disabled={syncing}
        >
          {syncing ? "🔄 Syncing..." : "📧 Sync Gmail"}
        </button>
      </div>

      <div
        className={`dropzone dropzone-lg ${dragOver ? "dragover" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="dropzone-text">
          <strong>Click to upload</strong> or drag and drop
        </div>
        <div className="dropzone-hint">PDF, DOCX, or TXT</div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {initialLoading ? (
        <div className="loading-state">Loading documents...</div>
      ) : (
        docs.length > 0 && (
          <div className="doc-list doc-list-lg">
            {docs.map((d, i) => (
              <div className="doc-item" key={`${d.filename}-${i}`} title={d.message || ""}>
                <div className="doc-meta">
                  <span className="doc-name">{d.filename}</span>
                  {d.upload_date && (
                    <span className="doc-date">{formatDate(d.upload_date)}</span>
                  )}
                </div>
                <span className={`doc-status ${d.status}`}>
                  {d.status === "uploading" ? "uploading…" : d.status}
                </span>
                {d.status !== "uploading" && (
                  <button
                    className="doc-delete-btn"
                    onClick={() => handleDelete(d.filename)}
                    disabled={deletingFile === d.filename}
                    aria-label={`Delete ${d.filename}`}
                    title="Delete document"
                  >
                    {deletingFile === d.filename ? "…" : "🗑"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}