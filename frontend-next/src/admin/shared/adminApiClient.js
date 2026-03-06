// apps/admin/src/shared/adminApiClient.js
import axios from "axios";

// Admin token - IZOLOVANÝ od client tokenu, NIKDY nesmí být smazán client logoutem
const ADMIN_TOKEN_KEY = "am_admin_token";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function getStoredToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setStoredToken(tok) {
  if (tok) {
    try { localStorage.setItem(ADMIN_TOKEN_KEY, tok); } catch {}
  } else {
    try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
  }
}

function clearStoredToken() {
  try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
}

// === jediná změna ===
// BaseURL = vždy https + host (bez http:, bez origin.replace)
function computeBaseURL() {
  if (typeof window === "undefined") return "";

  const envBase = API_BASE.trim();
  if (envBase) return envBase;

  const { protocol, hostname, port } = window.location || {};
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalHost && (port === "3000" || port === "8081" || port === "8083" || port === "8089")) {
    return `${protocol}//${hostname}:8050`;
  }

  return window.location?.origin || "";
}

const api = axios.create({
  baseURL: computeBaseURL(),
  withCredentials: true,
});

// Helper to build absolute URL to backend (uses same base logic as axios instance)
export function backendUrl(path = "") {
  const base = computeBaseURL() || "";
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path}`;
}

// nastav Authorization hned při startu
const boot = getStoredToken();
if (boot) api.defaults.headers.common.Authorization = `Bearer ${boot}`;

// Request: vždy admin token (am_admin_token) - IZOLOVANÝ od client tokenu
api.interceptors.request.use((config) => {
  const t = getStoredToken();
  config.headers = config.headers || {};
  if (t) config.headers.Authorization = `Bearer ${t}`;
  else delete config.headers.Authorization;
  return config;
});

let refreshing = null;

// Response: jednotný refresh toku
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err?.config || {};
    const status = err?.response?.status ?? 0;
    const url = String(cfg.url || "");
    const isLogin = url.includes("/auth/login") || url.includes("/api/v1/auth/login") || url.includes("/api/admin/v1/auth/login");
    const isRefresh = url.includes("/auth/refresh") || url.includes("/api/v1/auth/refresh") || url.includes("/api/admin/v1/auth/refresh");

    if ((status === 401 || status === 419) && !isLogin && !isRefresh && !cfg._retry) {
      try {
        // Admin refresh endpoint - STRICTLY pro administrátory
        if (!refreshing) refreshing = api.post("/api/admin/v1/auth/refresh");
        const { data } = await refreshing;
        refreshing = null;

        const nt = data?.access_token;
        if (nt) {
          setStoredToken(nt);
          api.defaults.headers.common.Authorization = `Bearer ${nt}`;
          cfg._retry = true;
          cfg.headers = cfg.headers || {};
          cfg.headers.Authorization = `Bearer ${nt}`;
          return api(cfg);
        }
      } catch {
        refreshing = null;
        clearStoredToken();
        delete api.defaults.headers.common.Authorization;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
