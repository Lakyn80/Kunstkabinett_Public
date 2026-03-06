// src/modules/admin/Categories.jsx
import { useEffect, useMemo, useState } from 'react';
import api from "../../shared/adminApiClient";

// jednoduché slugify (CZ diakritika -> ASCII, mezery -> -)
function slugify(input) {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export default function Categories() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  // list filtry
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // create form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  // edit form (inline v řádku)
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editSlugTouched, setEditSlugTouched] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // auto-slug pouze dokud uživatel ručně nezasáhne
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (editingId && !editSlugTouched) setEditSlug(slugify(editName));
  }, [editName, editSlugTouched, editingId]);

  const canCreate = useMemo(() => name.trim() && slug.trim(), [name, slug]);

  const params = useMemo(() => {
    const p = { limit, offset };
    if (q) p.q = q;
    return p;
  }, [q, limit, offset]);

  const load = async () => {
    setLoading(true);
    setErr('');
    setInfo('');
    try {
      // Admin endpoint (chráněný): sjednocený prefix /api/admin/v1/categories/
      const { data } = await api.get('/api/admin/v1/categories/', { params });
      const list = data?.items || data || [];
      setRows(list);
      setTotal(
        data?.total ??
        (data?.items ? data.items.length : (Array.isArray(data) ? data.length : 0))
      );
    } catch (e) {
      setErr('Načtení kategorií selhalo.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setErr(''); setInfo('');
    try {
      await api.post('/api/admin/v1/categories/', {
        name: name.trim(),
        slug: slug.trim(),
      });
      setName('');
      setSlug('');
      setSlugTouched(false);
      setInfo('Kategorie byla vytvořena.');
      await load();
    } catch (e) {
      let msg = 'Vytvoření kategorie selhalo.';
      const detail = e?.response?.data?.detail;
      if (typeof detail === 'string') msg = detail;
      setErr(msg);
    } finally {
      setCreating(false);
    }
  };

  // --- EDIT ---
  const startEdit = (row) => {
    setEditingId(row.id);
    setEditName(row.title || row.name || '');
    setEditSlug(row.slug || '');
    setEditSlugTouched(false);
    setErr(''); setInfo('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditSlug('');
    setEditSlugTouched(false);
  };

  const saveEdit = async (id) => {
    if (!editName.trim() || !editSlug.trim()) {
      setErr('Vyplňte název i slug.');
      return;
    }
    setSavingId(id);
    setErr(''); setInfo('');
    try {
      await api.patch(`/api/admin/v1/categories/${id}`, {
        name: editName.trim(),
        slug: editSlug.trim(),
      });
      setInfo('Kategorie byla upravena.');
      cancelEdit();
      await load();
    } catch (e) {
      let msg = 'Úprava kategorie selhala.';
      const detail = e?.response?.data?.detail;
      if (typeof detail === 'string') msg = detail;
      setErr(msg);
    } finally {
      setSavingId(null);
    }
  };

  // --- DELETE ---
  const deleteRow = async (id) => {
    if (!window.confirm('Opravdu smazat tuto kategorii? Tuto akci nelze vrátit.')) return;
    setDeletingId(id);
    setErr(''); setInfo('');
    try {
      await api.delete(`/api/admin/v1/categories/${id}`);
      setInfo('Kategorie byla smazána.');
      if (editingId === id) cancelEdit();
      await load();
    } catch (e) {
      let msg = 'Smazání kategorie selhalo.';
      const detail = e?.response?.data?.detail;
      if (typeof detail === 'string') msg = detail;
      setErr(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil((total || 0) / limit));

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kategorie</h1>
      </div>

      {/* Vytvořit novou kategorii */}
      <form onSubmit={onCreate} className="rounded border bg-white p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Název</label>
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Sochy"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Slug</label>
            <input
              className="input w-full"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
              placeholder="sochy"
              required
            />
          </div>
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        {info && <div className="text-sm text-green-700">{info}</div>}
        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={!canCreate || creating}>
            {creating ? 'Vytvářím…' : 'Vytvořit kategorii'}
          </button>
        </div>
      </form>

      {/* Filtry seznamu */}
      <form onSubmit={(e) => { e.preventDefault(); setOffset(0); load(); }} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-sm mb-1">Hledat</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="název nebo slug…"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Na stránku</label>
          <select
            className="input"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value) || 50); setOffset(0); }}
          >
            {[10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button className="btn" disabled={loading}>
          {loading ? 'Načítám…' : 'Filtrovat'}
        </button>
      </form>

      {/* Info */}
      <div className="text-sm text-gray-600">Celkem: {total}</div>

      {/* Tabulka kategorií */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr>
              <th className="py-2">ID</th><th>Název</th><th>Slug</th><th className="text-right">Akce</th></tr>
          </thead><tbody>
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} className="border-t"><td className="py-2">{r.id}</td>

                  {/* Název */}
                  <td className="py-2">
                    {isEditing ? (
                      <input
                        className="input w-full"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Název"
                      />
                    ) : (
                      <span>{r.title || r.name}</span>
                    )}
                  </td>

                  {/* Slug */}
                  <td className="py-2">
                    {isEditing ? (
                      <input
                        className="input w-full"
                        value={editSlug}
                        onChange={(e) => { setEditSlugTouched(true); setEditSlug(e.target.value); }}
                        placeholder="slug"
                      />
                    ) : (
                      <span>{r.slug}</span>
                    )}
                  </td>

                  {/* Akce */}
                  <td className="py-2 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="btn btn-primary"
                          onClick={() => saveEdit(r.id)}
                          disabled={savingId === r.id}
                          title="Uložit změny"
                        >
                          {savingId === r.id ? 'Ukládám…' : 'Uložit'}
                        </button>
                        <button className="btn" onClick={cancelEdit} title="Zrušit">
                          Zrušit
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button className="btn" onClick={() => startEdit(r)} title="Upravit">
                          Upravit
                        </button>
                        <button
                          className="btn"
                          onClick={() => deleteRow(r.id)}
                          disabled={deletingId === r.id}
                          title="Smazat"
                        >
                          {deletingId === r.id ? 'Mažu…' : 'Smazat'}
                        </button>
                      </div>
                    )}
                  </td></tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-500">Žádné kategorie</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Stránkování */}
      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>Strana {page} / {pages}</div>
        <div className="flex items-center gap-2">
          <button
            className="btn"
            onClick={() => setOffset(o => Math.max(0, o - limit))}
            disabled={loading || offset === 0}
          >
            ◀ Předchozí
          </button>
          <button
            className="btn"
            onClick={() => setOffset(o => o + limit)}
            disabled={loading || page >= pages}
          >
            Další ▶
          </button>
        </div>
      </div>
    </div>
  );
}