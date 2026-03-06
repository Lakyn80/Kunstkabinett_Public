// apps/admin/src/modules/admin/Blog/BlogEdit.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import blogApi from "./blogApi";
import api, { backendUrl } from "../../../shared/adminApiClient";

/** Upload cover souboru – používá správný endpoint /api/v1/media/upload */
async function uploadCover(file) {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("scope", "blog"); // Důležité: scope="blog" pro správné uložení
    
    // Axios automaticky nastaví Content-Type pro FormData, nemusíme ho ručně nastavovat
    const { data } = await api.post("/api/v1/media/upload", form);
    
    // Backend vrací { ok: true, url: "...", filename: "...", ... }
    const url = data?.url || data?.file_url || data?.path || "";
    if (!url) {
      throw new Error("Odpověď neobsahuje URL");
    }
    return url;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

function toPreviewUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:\/\/|blob:|data:)/i.test(raw)) return raw;
  return backendUrl(raw.startsWith("/") ? raw : `/${raw}`);
}

function CoverField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(""); setBusy(true);
    try {
      const url = await uploadCover(f);
      onChange(url);
    } catch {
      const localUrl = URL.createObjectURL(f);
      onChange(localUrl);
      setErr("Soubor byl jen lokálně předvyplněn (upload selhal).");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs">Cover obrázek</label>
      <div className="flex gap-2">
        <input
          className="input h-9 text-sm flex-1"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… (nebo nahraj soubor níže)"
        />
        {value ? (
          <button type="button" className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50" onClick={() => onChange("")} title="Odstranit">
            X
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="file" accept="image/*" onChange={onPickFile} disabled={busy} />
          {busy ? "Nahrávám…" : "Nahrát soubor"}
        </label>
        {err && <span className="text-[11px] text-amber-600">{err}</span>}
      </div>
      {value && (
        <div className="mt-2 overflow-hidden rounded-xl border">
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <img src={toPreviewUrl(value)} alt="cover preview" className="absolute inset-0 h-full w-full object-contain bg-white" loading="lazy" decoding="async" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Sanitizace slugu. */
function sanitizeSlug(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function normalizeContentInput(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shortenContentCopy(value, maxLen = 520) {
  const clean = normalizeContentInput(value);
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;

  const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
  let out = "";
  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    const candidate = out ? `${out} ${sentence}` : sentence;
    if (candidate.length > maxLen) break;
    out = candidate;
    if (out.length >= Math.floor(maxLen * 0.8)) break;
  }
  if (!out) out = clean.slice(0, maxLen).trim();
  return `${out.replace(/[,\s]+$/, "").trim()}…`;
}

function makeMarketingContent(value) {
  const clean = normalizeContentInput(value);
  if (!clean) return "";
  const intro = "Objevte příběh a kontext, které dají tomuto tématu nový rozměr.";
  if (clean.startsWith(intro)) return clean;
  return `${intro}\n\n${clean}`;
}

function regenerateContent(value, title) {
  const clean = normalizeContentInput(value);
  const cleanTitle = normalizeContentInput(title);
  if (!clean && !cleanTitle) return "";
  if (!clean) {
    return `V tomto článku se věnujeme tématu „${cleanTitle}“ a jeho významu v širším uměleckém kontextu.`;
  }
  const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
  const core = sentences.slice(0, 3).map((s) => s.trim()).filter(Boolean).join(" ");
  const opening = cleanTitle
    ? `V tomto článku se zaměřujeme na téma „${cleanTitle}“ a jeho praktický přesah.`
    : "V tomto článku se zaměřujeme na hlavní souvislosti tématu a jeho dopad.";
  return `${opening}\n\n${core}`;
}

export default function BlogEdit() {
  const { id } = useParams();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [contentToolErr, setContentToolErr] = useState("");

  // Translation states
  const [translations, setTranslations] = useState({});
  const [selectedLang, setSelectedLang] = useState('en');
  const [translationTitle, setTranslationTitle] = useState('');
  const [translationContent, setTranslationContent] = useState('');
  const [savingTranslation, setSavingTranslation] = useState(false);

  const AVAILABLE_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ru', name: 'Русский' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'it', name: 'Italiano' },
    { code: 'pl', name: 'Polski' }
  ];

  // sleduje, zda uživatel ručně zasáhl do slugu
  const slugTouchedRef = useRef(false);
  const lastAutoSlugRef = useRef("");

  const loadTranslations = async () => {
    try {
      const { data } = await api.get(`/api/admin/v1/blog/${id}/translations`);
      const translationsData = data || {};
      setTranslations(translationsData);
      // Load current language translation if exists
      if (translationsData && translationsData[selectedLang]) {
        setTranslationTitle(translationsData[selectedLang].title || '');
        setTranslationContent(translationsData[selectedLang].content || '');
      } else {
        setTranslationTitle('');
        setTranslationContent('');
      }
      return translationsData;
    } catch (err) {
      console.error('Failed to load translations:', err);
      setTranslations({});
      return {};
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await blogApi.get(id);
        if (!alive) return;
        const t = data.title || "";
        const s = data.slug || "";
        setTitle(t);
        setSlug(s);
        lastAutoSlugRef.current = s || sanitizeSlug(t);
        slugTouchedRef.current = Boolean(s); // pokud existuje slug, bereme jako "ručně nastavený"
        setContent(data.content || "");
        setCoverUrl(data.cover_url || "");
        setStatus(data.status || "draft");
        const translationsData = await loadTranslations();
        // Pokud nejsou žádné překlady, počkej a zkus znovu (automatické překlady se vytvářejí na pozadí)
        if (alive && Object.keys(translationsData).filter(lang => lang !== 'cs').length === 0) {
          setTimeout(async () => {
            if (alive) await loadTranslations();
          }, 3000);
        }
      } catch {
        setErr("Načtení se nepodařilo.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // Load translation when language changes
  useEffect(() => {
    if (translations[selectedLang]) {
      setTranslationTitle(translations[selectedLang].title || '');
      setTranslationContent(translations[selectedLang].content || '');
    } else {
      setTranslationTitle('');
      setTranslationContent('');
    }
  }, [selectedLang, translations]);

  // změna titulku → auto-slug pokud slug nebyl ručně upraven
  const onTitleChange = (v) => {
    setTitle(v);
    const auto = sanitizeSlug(v);
    if (!slugTouchedRef.current || slug === "" || slug === lastAutoSlugRef.current) {
      setSlug(auto);
      lastAutoSlugRef.current = auto;
    }
  };

  // ruční změna slugu
  const onSlugChange = (v) => {
    const s = sanitizeSlug(v);
    setSlug(s);
    slugTouchedRef.current = true;
  };

  const regenSlug = () => {
    const auto = sanitizeSlug(title);
    setSlug(auto);
    lastAutoSlugRef.current = auto;
    slugTouchedRef.current = false; // umožní zase auto-sync s titulkem
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const normalizedCoverUrl = (coverUrl || "").trim();
      const persistedCoverUrl = /^blob:/i.test(normalizedCoverUrl) ? null : (normalizedCoverUrl || null);
      const finalSlug = sanitizeSlug(slug) || sanitizeSlug(title);
      const payload = {
        title: title.trim(),
        slug: finalSlug,                 // klíčové
        content: content || null,
        cover_url: persistedCoverUrl,
        status,
      };
      await blogApi.update(id, payload);
      // Počkej chvíli na dokončení automatických překladů na pozadí, pak načti překlady
      setTimeout(async () => {
        await loadTranslations();
      }, 2000);
      // Ne přesměrovávej, zůstaň na stránce, aby uživatel viděl překlady
    } catch {
      setErr("Uložení se nepodařilo. Zkontroluj povinná pole a unikátní slug.");
    } finally { setSaving(false); }
  };

  const onSaveTranslation = async (e) => {
    e.preventDefault();
    if (!translationTitle.trim()) {
      alert('Title is required');
      return;
    }
    setSavingTranslation(true);
    try {
      await api.post(`/api/admin/v1/blog/${id}/translations/${selectedLang}`, {
        title: translationTitle,
        content: translationContent || null
      });
      await loadTranslations();
      alert('Translation saved successfully!');
    } catch (error) {
      console.error('Failed to save translation:', error);
      alert('Failed to save translation');
    } finally {
      setSavingTranslation(false);
    }
  };

  const onShortenContent = () => {
    if (!content.trim()) {
      setContentToolErr("Nejprve doplň obsah.");
      return;
    }
    setContentToolErr("");
    setContent(shortenContentCopy(content));
  };

  const onMarketingContent = () => {
    if (!content.trim()) {
      setContentToolErr("Nejprve doplň obsah.");
      return;
    }
    setContentToolErr("");
    setContent(makeMarketingContent(content));
  };

  const onRegenerateContent = () => {
    if (!content.trim() && !title.trim()) {
      setContentToolErr("Nejprve doplň název nebo obsah.");
      return;
    }
    setContentToolErr("");
    setContent(regenerateContent(content, title));
  };

  if (loading) return <div className="card p-6">Načítám…</div>;

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Upravit příspěvek</h1>
        <Link to="/admin/blog" className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50">← Zpět</Link>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-xs mb-1">Název *</label>
          <input
            className="input h-9 text-sm"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
            placeholder="Titulek článku…"
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Slug *</label>
          <div className="flex gap-2">
            <input
              className="input h-9 text-sm flex-1"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              placeholder="unikátní-url-cast"
              required
            />
            <button type="button" className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50" onClick={regenSlug} title="Znovu vygenerovat ze názvu">
              ↺
            </button>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Použije se v URL. Musí být unikátní.</div>
        </div>

        <CoverField value={coverUrl} onChange={setCoverUrl} />

        <div>
          <label className="block text-xs mb-1">Obsah (HTML / prostý text)</label>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={onShortenContent}
            >
              Zkrátit popis
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 text-sm font-medium text-orange-800 shadow-sm transition hover:from-orange-100 hover:to-amber-100"
              onClick={onMarketingContent}
            >
              Více marketingový popis
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700"
              onClick={onRegenerateContent}
            >
              Vygenerovat nový popis
            </button>
          </div>
          {contentToolErr && <div className="text-red-600 text-sm mb-2">{contentToolErr}</div>}
          <textarea
            className="input text-sm min-h-[220px] font-mono"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Sem vlož HTML tagy nebo čistý text…"
          />
          <div className="text-[11px] text-gray-500 mt-1">
            Vložené HTML se zobrazí na webu 1:1.
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1">Status</label>
          <select className="input h-9 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs rounded bg-black text-white" disabled={saving}>
            {saving ? "Ukládám…" : "Uložit"}
          </button>
          <Link to="/admin/blog" className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50">Zrušit</Link>
        </div>
      </form>

      {/* Translations Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Překlady</h3>
          <div className="text-xs text-blue-600 font-medium">
            ℹ️ Automatické překlady přes DeepSeek API se vytváří při uložení změn.
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium">Vyberte jazyk:</label>
          <select
            className="input w-64"
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
          >
            {AVAILABLE_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.code})
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={onSaveTranslation} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">
              Název ({AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name})
            </label>
            <input
              className="input w-full"
              value={translationTitle}
              onChange={(e) => setTranslationTitle(e.target.value)}
              placeholder={`Přeložený název v jazyce ${AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name}`}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              Obsah ({AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name})
            </label>
            <textarea
              className="input w-full text-sm min-h-[220px] font-mono"
              value={translationContent}
              onChange={(e) => setTranslationContent(e.target.value)}
              placeholder={`Přeložený obsah v jazyce ${AVAILABLE_LANGUAGES.find(l => l.code === selectedLang)?.name}`}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {translations[selectedLang] ?
                'Překlad existuje - kliknutím na "Uložit překlad" aktualizujete.' :
                'Překlad neexistuje - kliknutím na "Uložit překlad" vytvoříte nový.'}
            </div>
            <button
              className="px-3 py-1.5 text-xs rounded bg-black text-white hover:opacity-90 disabled:opacity-60"
              type="submit"
              disabled={savingTranslation}
            >
              {savingTranslation ? 'Ukládám…' : 'Uložit překlad'}
            </button>
          </div>
        </form>

        {/* Existing translations list */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium text-sm mb-3">Existující překlady:</h4>
          <div className="space-y-2">
            {Object.keys(translations).filter(lang => lang !== 'cs').length === 0 ? (
              <div className="text-sm text-gray-500">Zatím žádné překlady.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.keys(translations).filter(lang => lang !== 'cs').map(lang => (
                  <div key={lang} className="border rounded p-3 text-sm">
                    <div className="font-medium">
                      {AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name || lang} ({lang})
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {translations[lang]?.title?.substring(0, 50)}
                      {translations[lang]?.title?.length > 50 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
