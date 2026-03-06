// src/lib/theme.js
const STORAGE_KEY = 'am_dark'; // sladěno s index.html ('1' / '0')

export function getInitialDark() {
  try {
    // 1) primárně nový klíč
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;

    // 2) migrace ze starého klíče 'theme_dark' ('true'/'false')
    const legacy = localStorage.getItem('theme_dark');
    if (legacy === 'true' || legacy === 'false') {
      const v = legacy === 'true';
      // zapiš do nového formátu a starý klíč zahoď
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
      localStorage.removeItem('theme_dark');
      return v;
    }

    // 3) fallback: systémové nastavení
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function applyDark(dark) {
  const root = document.documentElement;
  if (dark) root.classList.add('dark');
  else root.classList.remove('dark');
  try {
    // zapisuj ve formátu, který načítá index.html
    localStorage.setItem(STORAGE_KEY, dark ? '1' : '0');
  } catch {}
}
