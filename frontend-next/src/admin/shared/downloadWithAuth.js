import { backendUrl } from "./adminApiClient";

export async function downloadWithAuth(url, filename) {
  // Admin aplikace - použij pouze admin token (client token je izolovaný)
  const token = localStorage.getItem('am_admin_token') || '';
  const res = await fetch(backendUrl(url), {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed (${res.status}): ${text}`);
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
