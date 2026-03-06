// src/modules/admin/Users.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from "../../shared/adminApiClient";

const ROLE_OPTIONS_MUTABLE = [
  { value: 'customer', label: 'customer' },
  { value: 'editor', label: 'editor' },
];

export default function Users() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState('');
  const [role, setRole] = useState('');

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [draftRoles, setDraftRoles] = useState({}); // { [id]: 'editor' }

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  // rozdělení admin vs ostatní (na základě aktuálně načtené stránky)
  const adminUser = useMemo(() => rows.find(r => r.role === 'admin') || null, [rows]);
  const nonAdminRows = useMemo(() => rows.filter(r => r.role !== 'admin'), [rows]);

  const buildParams = () => {
    const params = { limit, offset };
    if (q) params.q = q;
    if (role) params.role = role;
    return params;
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/v1/users/', { params: buildParams() });
      const items = data.items || [];
      setRows(items);
      setTotal(data.total || 0);

      // draft = aktuální role (admin sice bude nahoře vyčleněn, ale držíme konzistenci)
      const nextDrafts = {};
      items.forEach(u => { nextDrafts[u.id] = u.role; });
      setDraftRoles(nextDrafts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // při vstupu

  const onFilter = async () => {
    setOffset(0);
    await load();
  };

  const changePage = async (direction) => {
    if (direction === 'prev' && offset > 0) {
      setOffset(o => Math.max(0, o - limit));
    }
    if (direction === 'next' && page < pages) {
      setOffset(o => o + limit);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, limit]);

  const saveRole = async (id) => {
    const current = rows.find(r => r.id === id);
    if (!current) return;

    // Admin se nikdy nemění (tady navíc nikdy nebude v akčních tlačítcích)
    if (current.role === 'admin') return;

    const newRole = draftRoles[id];
    if (!newRole || newRole === current.role) return;

    setSavingId(id);
    try {
      await api.post(`/api/admin/v1/users/${id}/role`, { role: newRole });
      await load(); // refresh
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="card p-6 space-y-6">
      {/* Filtry nahoře */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-sm mb-1">Hledat</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="email..."
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">(vše)</option>
            <option value="customer">customer</option>
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Na stránku</label>
          <select
            className="input"
            value={limit}
            onChange={(e) => {
              const v = Number(e.target.value) || 20;
              setLimit(v);
              setOffset(0);
            }}
          >
            {[10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={onFilter} disabled={loading}>
          {loading ? 'Načítám…' : 'Filtrovat'}
        </button>
      </div>

      {/* Vystavený admin (odděleně od tabulky) */}
      {adminUser && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Administrátor</div>
              <div className="mt-1 text-lg font-semibold">{adminUser.email}</div>
              <div className="mt-1 inline-block rounded px-2 py-0.5 text-xs bg-gray-100 text-gray-800">
                Admin (neměnný)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/admin/users/${adminUser.id}`} className="btn">Detail</Link>
            </div>
          </div>
        </div>
      )}

      {/* Info o celkovém počtu nad tabulkou */}
      <div className="text-sm text-gray-600">Celkem: {total}</div>

      {/* Tabulka – jen ne-admin uživatelé */}
      <table className="w-full text-left text-sm">
        <thead><tr>
            <th className="py-2">ID</th><th>E-mail</th><th>Role</th><th className="py-2">Akce</th></tr>
        </thead><tbody>
          {nonAdminRows.map((r) => (
            <tr key={r.id} className="border-t"><td className="py-2">{r.id}</td><td>
                <Link to={`/admin/users/${r.id}`} className="text-blue-600 hover:underline">
                  {r.email}
                </Link>
              </td><td>
                <select
                  className="input"
                  value={draftRoles[r.id] ?? r.role}
                  onChange={(e) =>
                    setDraftRoles((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                >
                  {ROLE_OPTIONS_MUTABLE.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td><td className="py-2 flex gap-2">
                <button
                  className="btn"
                  onClick={() => saveRole(r.id)}
                  disabled={savingId === r.id}
                  title="Uložit roli"
                >
                  {savingId === r.id ? 'Ukládám…' : 'Uložit'}
                </button>
                <Link to={`/admin/users/${r.id}`} className="btn" title="Detail">
                  Detail
                </Link>
              </td></tr>
          ))}
          {nonAdminRows.length === 0 && !loading && (
            <tr><td colSpan={4} className="py-6 text-center text-gray-500">
                Žádní uživatelé
              </td></tr>
          )}
        </tbody>
      </table>

      {/* Stránkování POD seznamem */}
      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>Strana {page} / {pages}</div>
        <div className="flex items-center gap-2">
          <button
            className="btn"
            onClick={() => changePage('prev')}
            disabled={loading || offset === 0}
          >
            ◀ Předchozí
          </button>
          <button
            className="btn"
            onClick={() => changePage('next')}
            disabled={loading || page >= pages}
          >
            Další ▶
          </button>
        </div>
      </div>
    </div>
  );
}