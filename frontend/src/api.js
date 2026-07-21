const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("ikb-token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

function handleAuthFailure(res) {
  if (res.status === 401) {
    localStorage.removeItem("ikb-token");
    localStorage.removeItem("ikb-industry-code");
    localStorage.removeItem("ikb-industry-name");
    localStorage.removeItem("ikb-user-email");
    window.location.href = "/login.html";
  }
}

// ---- Auth Functions ----

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Login failed");
  }

  const data = await res.json();
  localStorage.setItem("ikb-token", data.token);
  localStorage.setItem("ikb-industry-code", data.industry_code);
  localStorage.setItem("ikb-industry-name", data.industry_name);
  localStorage.setItem("ikb-user-email", data.email);
  return data;
}

export async function signupUser(email, password, industry_name, industry_code) {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, industry_name, industry_code }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Signup failed");
  }

  const data = await res.json();
  localStorage.setItem("ikb-token", data.token);
  localStorage.setItem("ikb-industry-code", data.industry_code);
  localStorage.setItem("ikb-industry-name", data.industry_name);
  localStorage.setItem("ikb-user-email", data.email);
  return data;
}

export function logoutUser() {
  localStorage.removeItem("ikb-token");
  localStorage.removeItem("ikb-industry-code");
  localStorage.removeItem("ikb-industry-name");
  localStorage.removeItem("ikb-user-email");
  window.location.href = "/login.html";
}

// ---- Data / Graph / Chat / Sync Endpoints ----

export async function syncGmail() {
  const res = await fetch(`${API_BASE_URL}/gmail/sync`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  handleAuthFailure(res);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `/gmail/sync failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchCascade(nodeId, depth = 2) {
  const res = await fetch(`${API_BASE_URL}/cascade/${encodeURIComponent(nodeId)}?depth=${depth}`, {
    headers: { ...authHeaders() },
  });
  handleAuthFailure(res);
  if (!res.ok) throw new Error(`/cascade failed: ${res.status}`);
  return res.json();
}

export async function askBrain(query, { n_results = 5, graph_depth = 1 } = {}) {
  const res = await fetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, n_results, graph_depth }),
  });
  handleAuthFailure(res);
  if (!res.ok) throw new Error(`/ask failed: ${res.status}`);
  return res.json();
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/`);
  if (!res.ok) throw new Error(`health check failed: ${res.status}`);
  return res.json();
}

export async function fetchFlags() {
  const res = await fetch(`${API_BASE_URL}/flags`, {
    headers: { ...authHeaders() },
  });
  handleAuthFailure(res);
  if (!res.ok) throw new Error(`/flags failed: ${res.status}`);
  return res.json();
}

export async function uploadFiles(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: formData,
  });
  handleAuthFailure(res);
  if (!res.ok) throw new Error(`/upload failed: ${res.status}`);
  return res.json();
}

export async function deleteDocument(filename) {
  const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  handleAuthFailure(res);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `delete failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchGraph() {
  const res = await fetch(`${API_BASE_URL}/graph`, {
    headers: { ...authHeaders() },
  });
  handleAuthFailure(res);
  if (!res.ok) throw new Error(`/graph failed: ${res.status}`);
  return res.json();
}

export async function fetchDocuments() {
  const res = await fetch(`${API_BASE_URL}/documents`, {
    headers: { ...authHeaders() },
  });
  handleAuthFailure(res);
  if (!res.ok) throw new Error(`/documents failed: ${res.status}`);
  return res.json();
}

export function getDocumentUrl(filename) {
  const token = localStorage.getItem("ikb-token");
  return `${API_BASE_URL}/files/${encodeURIComponent(filename)}?token=${token}`;
}