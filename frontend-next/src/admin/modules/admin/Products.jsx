// src/modules/admin/Products.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from "../../shared/adminApiClient";

function getArtistName(row) {
  const r = row || {};
  const a = r.artist || r.author || {};

  if (r.artist_name) return r.artist_name;
  if (r.author_name) return r.author_name;
  if (r.artist_full_name) return r.artist_full_name;

  if (typeof a === 'string' && a) return a;
  if (a.full_name) return a.full_name;
  if (a.name) return a.name;

  const first = r.artist_first_name || a.first_name || a.firstname || '';
  const last  = r.artist_last_name  || a.last_name  || a.lastname  || '';
  const combo = [first, last].filter(Boolean).join(' ');
  if (combo) return combo;

  return '—';
}

export default function Products() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [allProductsForFilter, setAllProductsForFilter] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const allVisibleSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selectedIds.has(r.id)),
    [rows, selectedIds]
  );

  const params = useMemo(() => {
    const p = { limit, offset };
    if (productFilter) p.q = productFilter;
    else if (q) p.q = q;
    return p;
  }, [q, productFilter, limit, offset]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/v1/products/', { params });
      setRows(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  const loadProductsForFilter = async () => {
    try {
      const { data } = await api.get('/api/admin/v1/products/', { params: { limit: 200, offset: 0 } });
      setAllProductsForFilter(data.items || []);
    } catch {
      setAllProductsForFilter([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);
  useEffect(() => { loadProductsForFilter(); /* eslint-disable-next-line */ }, []);

  const onFilter = (e) => {
    e?.preventDefault?.();
    setOffset(0);
    load();
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    if (!rows.length) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const changePage = (dir) => {
    if (dir === 'prev' && offset > 0) setOffset(o => Math.max(0, o - limit));
    if (dir === 'next' && page < pages) setOffset(o => o + limit);
  };

  const onToggleFeatured = async (id, checked) => {
    setTogglingId(id);
    try {
      await api.patch(`/api/admin/v1/products/${id}`, { featured: checked });
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, featured: checked } : row)));
    } finally {
      setTogglingId(null);
    }
  };

  const deleteOne = async (id) => {
    if (!window.confirm('Opravdu smazat tento produkt?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/v1/products/${id}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await load();
      await loadProductsForFilter();
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Opravdu smazat vybrané produkty (${selectedIds.size})?`)) return;
    setDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await api.delete(`/api/admin/v1/products/${id}`);
      }
      setSelectedIds(new Set());
      await load();
      await loadProductsForFilter();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Produkty</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={deleteSelected}
            disabled={loading || deleting || selectedIds.size === 0}
            className="btn border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Smazat vybrané
          </button>
          <Link to="/admin/products/new" className="btn btn-primary">
            + Nový produkt
          </Link>
        </div>
      </div>

      <form onSubmit={onFilter} className="flex flex-wrap items-end gap-2 mb-4">
        <div>
          <label className="block text-sm mb-1">Hledat</label>
          <input
            className="input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (productFilter) setProductFilter('');
            }}
            placeholder="název nebo slug…"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Dílo</label>
          <select
            className="input"
            value={productFilter}
            onChange={(e) => {
              const value = e.target.value;
              setProductFilter(value);
              setOffset(0);
            }}
          >
            <option value="">— všechna díla —</option>
            {allProductsForFilter.map((item) => (
              <option key={item.id} value={item.slug || item.title || String(item.id)}>
                {item.title || '(bez názvu)'} #{item.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Na stránku</label>
          <select
            className="input"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value) || 20); setOffset(0); }}
          >
            {[10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button className="btn" disabled={loading}>
          {loading ? 'Načítám…' : 'Filtrovat'}
        </button>
      </form>

      <div className="text-sm text-gray-600 mb-2">Celkem: {total}</div>
      <div className="text-sm text-gray-600 mb-2">Vybráno: {selectedIds.size}</div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectVisible}
                disabled={rows.length === 0}
                className="w-4 h-4"
              />
            </th>
            <th className="py-2">ID</th>
            <th>Název</th>
            <th>Slug</th>
            <th>Autor</th>
            <th>Cena</th>
            <th>Sklad</th>
            <th>Vybraná díla</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelectOne(r.id)}
                  className="w-4 h-4"
                />
              </td>
              <td className="py-2">{r.id}</td>
              <td>
                <button
                  className="underline hover:opacity-80"
                  onClick={() => nav(`/admin/products/${r.id}`)}
                  title="Otevřít detail"
                >
                  {r.title || '(bez názvu)'}
                </button>
              </td>
              <td>{r.slug}</td>
              <td>{getArtistName(r)}</td>
              <td>{r.price ?? '—'}</td>
              <td>{r.stock ?? 0}</td>
              <td>
                <label className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-300">
                  <input
                    type="checkbox"
                    checked={!!r.featured}
                    disabled={togglingId === r.id}
                    onChange={(e) => onToggleFeatured(r.id, e.target.checked)}
                    className="w-4 h-4"
                  />
                </label>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => deleteOne(r.id)}
                    disabled={deleting}
                    className="btn border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Smazat
                  </button>
                  <Link className="btn" to={`/admin/products/${r.id}`}>Detail</Link>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={9} className="py-10 text-center text-gray-500">
                Zatím žádné položky{' '}
                <Link to="/admin/products/new" className="underline hover:opacity-80">
                  Vytvoř první produkt
                </Link>
                .
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex items-center justify-between mt-4 text-sm text-gray-700">
        <div>Strana {page} / {pages}</div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => changePage('prev')} disabled={loading || offset === 0}>
            ◀ Předchozí
          </button>
          <button className="btn" onClick={() => changePage('next')} disabled={loading || page >= pages}>
            Další ▶
          </button>
        </div>
      </div>
    </div>
  );
}
