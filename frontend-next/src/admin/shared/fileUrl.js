// src/shared/fileUrl.js
import api from './apiClient';

/**
 * Vrátí absolutní URL pro soubor z BE.
 * Pokud path už je absolutní (http/https), nechá se jak je.
 * Jinak se prefixedne origin z api.baseURL (např. http://127.0.0.1:8000).
 */
export function resolveFileUrl(path) {
  if (!path) return '';
  const s = String(path);
  if (s.startsWith('http://') || s.startsWith('https://')) return s;

  // Získáme origin z api.defaults.baseURL; fallback na window.location.origin
  let origin = '';
  try {
    origin = new URL(api.defaults.baseURL, window.location.origin).origin;
  } catch {
    origin = window.location.origin;
  }
  return `${origin}${s.startsWith('/') ? '' : '/'}${s}`;
}
