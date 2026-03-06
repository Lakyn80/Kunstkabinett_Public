import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { backendUrl } from "../../shared/adminApiClient";

function normalizeError(err, fallback) {
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

function getMediaUrl(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const rel = raw.startsWith("/uploads/") ? raw : `/uploads/${raw.replace(/^\/+/, "")}`;
  return backendUrl(rel);
}

export default function MediaInbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [createdProductIds, setCreatedProductIds] = useState([]);
  const fileInputRef = useRef(null);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const loadPending = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/media-inbox/pending");
      setItems(data?.items || []);
    } catch (err) {
      setError(normalizeError(err, "Nepodařilo se načíst Media AI Inbox."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const allSelected = useMemo(
    () => items.length > 0 && items.every((item) => selected.has(item.id)),
    [items, selected]
  );

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!items.length) return;
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((item) => item.id)));
  };

  const onUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setActionError("");
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const res = await fetch(backendUrl("/api/media-inbox/upload"), {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${localStorage.getItem("am_admin_token") || ""}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `Upload selhal (${res.status})`);
      }
      await loadPending();
      const rag = data?.rag || {};
      const msg = `RAG: adaptováno ${rag.adapted || 0}, nové ${rag.new_saved || 0}, neúspěch ${rag.new_failed || 0}`;
      showNotice(msg);
    } catch (err) {
      setActionError(normalizeError(err, "Upload selhal."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const assignSelectedAsProducts = async () => {
    setActionError("");
    setCreatedProductIds([]);
    if (!selected.size) {
      setActionError("Vyber alespoň jednu položku.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        items: Array.from(selected).map((id) => ({ inbox_id: id, assign_as: "product" })),
      };
      const { data } = await api.post("/api/media-inbox/assign", payload);
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        setActionError(`Některé položky nebyly přiřazeny (${data.errors.length}).`);
      }
      setCreatedProductIds(Array.isArray(data?.product_ids) ? data.product_ids : []);
      setSelected(new Set());
      await loadPending();
      showNotice("Hotovo");
    } catch (err) {
      setActionError(normalizeError(err, "Přiřazení selhalo."));
    } finally {
      setBusy(false);
    }
  };

  const deleteSingle = async (id) => {
    setActionError("");
    setBusy(true);
    try {
      await api.delete(`/api/media-inbox/${id}`);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadPending();
      showNotice("Smazáno");
    } catch (err) {
      setActionError(normalizeError(err, "Smazání selhalo."));
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    setActionError("");
    if (!selected.size) {
      setActionError("Vyber alespoň jednu položku.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/api/media-inbox/delete-batch", { ids: Array.from(selected) });
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        setActionError(`Některé položky nebyly smazány (${data.errors.length}).`);
      }
      setSelected(new Set());
      await loadPending();
      showNotice("Hotovo");
    } catch (err) {
      setActionError(normalizeError(err, "Smazání selhalo."));
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm("Opravdu smazat všechny položky z Media AI Inboxu?")) return;
    setActionError("");
    setBusy(true);
    try {
      await api.delete("/api/media-inbox/all");
      setSelected(new Set());
      await loadPending();
      showNotice("Inbox vyčištěn");
    } catch (err) {
      setActionError(normalizeError(err, "Smazání všeho selhalo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Media AI Inbox</h2>
        {notice && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
            {notice}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => onUploadFiles(e.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || uploading}
          className="rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
        >
          {uploading ? "Nahrávám..." : "Nahrát obrázky"}
        </button>
        <button
          type="button"
          onClick={assignSelectedAsProducts}
          disabled={busy || uploading}
          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          Vytvořit produkty z vybraných
        </button>
        <button
          type="button"
          onClick={toggleAll}
          disabled={busy || uploading || items.length === 0}
          className="rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
        >
          {allSelected ? "Zrušit výběr" : "Vybrat všechno"}
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={busy || uploading}
          className="rounded-md border border-red-300 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Smazat vybrané
        </button>
        <button
          type="button"
          onClick={deleteAll}
          disabled={busy || uploading || items.length === 0}
          className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          Smazat vše
        </button>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {actionError}
        </div>
      )}

      {createdProductIds.length > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <div className="font-medium mb-1">Vytvořené produkty:</div>
          <div className="flex flex-wrap gap-2">
            {createdProductIds.map((pid) => (
              <Link key={pid} to={`/admin/products/${pid}`} className="underline hover:opacity-80">
                #{pid}
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500">Načítání...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-md border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Žádné pending položky.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const checked = selected.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex flex-col rounded-lg border p-2 text-xs transition ${
                  checked ? "border-emerald-400 bg-emerald-50" : "border-gray-200"
                }`}
              >
                <div className="relative mb-2 h-32 overflow-hidden rounded bg-gray-100">
                  {getMediaUrl(item.webp_path) ? (
                    <img src={getMediaUrl(item.webp_path)} alt={item.filename || "Media"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">Bez náhledu</div>
                  )}
                  <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white">
                    {item.product_type || "other"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-gray-700">{item.draft_title || item.filename || `ID ${item.id}`}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => deleteSingle(item.id)}
                      className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50"
                    >
                      🗑️
                    </button>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(item.id)}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
                {item.draft_description && (
                  <p className="mt-1 text-[10px] text-gray-500">
                    {String(item.draft_description).slice(0, 220)}
                    {String(item.draft_description).length > 220 ? "…" : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
