import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

function computeBaseURL(): string {
  if (API_BASE && API_BASE.trim()) {
    return API_BASE.trim();
  }
  if (typeof window === "undefined") {
    return "";
  }

  const { protocol, hostname, port } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalHost && port === "3000") {
    return `${protocol}//${hostname}:8050`;
  }

  return window.location.origin || "";
}

export function absoluteBackendUrl(path = ""): string {
  const base = computeBaseURL() || "";
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path}`;
}

const api = axios.create({
  baseURL: computeBaseURL(),
  withCredentials: true,
});

const PUBLIC_LANG_ENDPOINTS = [
  "/api/v1/artists",
  "/api/v1/products",
  "/api/v1/categories",
  "/api/v1/blog",
];

api.interceptors.request.use((config) => {
  const method = String(config.method || "get").toLowerCase();
  if (method !== "get") return config;

  const url = String(config.url || "");
  const wantsLang = PUBLIC_LANG_ENDPOINTS.some((prefix) => url.startsWith(prefix));
  if (!wantsLang) return config;

  let lang: string | null = null;
  try {
    lang = localStorage.getItem("lang");
  } catch {
    lang = null;
  }

  if (!lang) return config;

  config.params = config.params || {};
  if (!config.params.lang) {
    config.params.lang = lang;
  }

  return config;
});

export default api;
