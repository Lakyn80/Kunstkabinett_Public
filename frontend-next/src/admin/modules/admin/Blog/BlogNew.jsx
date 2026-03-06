// apps/admin/src/modules/admin/Blog/BlogNew.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
          value={value}
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

/** Slugify: odstraní diakritiku, nahradí ne-alfanumeriku pomlčkami, zmenší. */
function slugify(s) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
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

export default function BlogNew() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [contentToolErr, setContentToolErr] = useState("");

  // pokud uživatel nezačal ručně měnit slug, generuj z title
  const slugTouched = useRef(false);
  useEffect(() => {
    if (!slugTouched.current) {
      setSlug(slugify(title));
    }
  }, [title]);

  const onSlugChange = (v) => {
    slugTouched.current = true;
    setSlug(slugify(v));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const normalizedCoverUrl = (coverUrl || "").trim();
      const persistedCoverUrl = /^blob:/i.test(normalizedCoverUrl) ? null : (normalizedCoverUrl || null);
      const payload = {
        title: title.trim(),
        slug: slug || slugify(title) || undefined,
        content: content || null,
        cover_url: persistedCoverUrl,
        status,
      };
      const { data } = await blogApi.create(payload);
      // Přesměruj na edit stránku, kde uvidí sekci s překlady
      // Počkej chvíli, aby se automatické překlady stihly vytvořit na pozadí
      if (data?.id) {
        setTimeout(() => {
          nav(`/admin/blog/${data.id}`, { replace: true });
        }, 1000);
      } else {
        nav("/admin/blog");
      }
    } catch {
      setErr("Uložení se nepodařilo. Zkontroluj povinná pole.");
    } finally { setSaving(false); }
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

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nový příspěvek</h1>
        <Link to="/admin/blog" className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50">← Zpět</Link>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-xs mb-1">Název *</label>
          <input
            className="input h-9 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Titulek článku…"
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Slug</label>
          <input
            className="input h-9 text-sm"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="automaticky z názvu"
          />
          <div className="text-[11px] text-gray-500 mt-1">URL část. Můžeš upravit.</div>
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
          <div className="text-[11px] text-blue-600 mt-1 font-medium">
            ℹ️ Překlady do všech jazyků se vytvoří automaticky po uložení pomocí DeepSeek API.
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
    </div>
  );
}
