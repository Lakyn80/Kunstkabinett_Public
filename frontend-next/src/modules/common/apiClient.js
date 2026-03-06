// src/modules/common/apiClient.js
import axios from "axios";

// --- helper: ensure a stable session_id for the visitor/client ---
function ensureSessionId() {
  try {
    let sid = localStorage.getItem("session_id");
    if (!sid) {
      sid =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("session_id", sid);
    }
    return sid;
  } catch {
    return (
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    );
  }
}

// Remap old client order paths to FE proxy /orders (GET only)
function remapOrderClientPath(url, method) {
  const m = (method || "").toLowerCase();
  if (m && m !== "get") return url;
  if (!url) return url;
  const u = String(url);
  // Do NOT remap special subpaths (bank info/qr, payments) – these live only under /api/client/v1/...
  if (u.includes("/bank") || u.includes("/pay-intent") || u.includes("/payments")) {
    return url;
  }
  if (u === "/api/client/v1/orders") return "/orders";
  if (u.startsWith("/api/client/v1/orders/")) {
    return u.replace(/^\/api\/client\/v1\/orders\//, "/orders/");
  }
  return url;
}

function remapIfNeeded(u, method) {
  try {
    return remapOrderClientPath(u, method);
  } catch {
    return u;
  }
}

// Compute baseURL: prefer VITE_API_BASE, otherwise origin; for local Docker (8080/8083) point to backend 8050
function computeBaseURL() {
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envBase) return envBase;

  if (typeof window === "undefined") return "";

  const { protocol, hostname, port } = window.location || {};
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalHost && (port === "3000" || port === "8080" || port === "8083")) {
    return `${protocol}//${hostname}:8050`;
  }

  return window.location?.origin || "";
}

const api = axios.create({
  baseURL: computeBaseURL(),
  withCredentials: true,
});

// Request
api.interceptors.request.use((config) => {
  config.url = remapIfNeeded(config.url, config.method);

  const tok = localStorage.getItem("am_client_token");
  config.headers = config.headers || {};
  if (tok) config.headers.Authorization = `Bearer ${tok}`;
  else delete config.headers.Authorization;

  const sid = ensureSessionId();
  config.headers["X-Session-Id"] = sid;

  // Propagate language selection (stored in localStorage as "lang") to public API calls
  const lang = (() => {
    try {
      return localStorage.getItem("lang");
    } catch {
      return null;
    }
  })();
  const isGet = String(config.method || "get").toLowerCase() === "get";
  const url = String(config.url || "");
  const wantsLang =
    url.startsWith("/api/v1/artists") ||
    url.startsWith("/api/v1/products") ||
    url.startsWith("/api/v1/categories") ||
    url.startsWith("/api/v1/blog");
  if (isGet && lang && wantsLang) {
    config.params = config.params || {};
    if (!config.params.lang) config.params.lang = lang;
  }

  return config;
});

let refreshing = null;

// Response
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err?.config || {};
    const status = err?.response?.status ?? 0;
    const url = String(cfg.url || "");
    const isLogin = url.includes("/api/v1/auth/login");
    const isRefresh = url.includes("/api/v1/auth/refresh");

    if (status === 401 && !isLogin && !isRefresh && !cfg._retry) {
      try {
        const refreshUrl = "/api/v1/auth/refresh";

        if (!refreshing) refreshing = api.post(refreshUrl);
        const { data } = await refreshing;
        refreshing = null;

        const nt = data?.access_token;
        if (nt) {
          localStorage.setItem("am_client_token", nt);
          api.defaults.headers.common.Authorization = `Bearer ${nt}`;
          cfg._retry = true;
          cfg.headers = cfg.headers || {};
          cfg.headers.Authorization = `Bearer ${nt}`;
          return api(cfg);
        }
      } catch {
        refreshing = null;
        localStorage.removeItem("am_client_token");
        delete api.defaults.headers.common.Authorization;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
