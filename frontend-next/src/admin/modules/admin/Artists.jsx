// apps/admin/src/modules/admin/Artists.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from "../../shared/adminApiClient";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Artists() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiBusyId, setAiBusyId] = useState(null);
  const [aiMsg, setAiMsg] = useState('');
  const [aiErr, setAiErr] = useState('');
  const [total, setTotal] = useState(0);
  const [filterLastname, setFilterLastname] = useState('');
  const [filterLetter, setFilterLetter] = useState('');
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const params = useMemo(() => {
    const p = { limit, offset };
    if (filterLastname.trim()) p.filter_lastname = filterLastname.trim();
    if (filterLetter) p.filter_letter = filterLetter;
    return p;
  }, [limit, offset, filterLastname, filterLetter]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/v1/artists/', { params });
      const list = data?.items || data || [];
      setRows(list);
      setTotal(
        data?.total ??
        (data?.items ? data.items.length : (Array.isArray(data) ? data.length : 0))
      );
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);

  const onGenerateArtistBio = async (artistId) => {
    setAiBusyId(artistId);
    setAiErr('');
    setAiMsg('');
    try {
      await api.post('/api/admin/v1/ai/artist-bio/generate', {
        artist_id: artistId,
        save_to_rag: true,
      });
      setAiMsg(`AI bio autora #${artistId} bylo vytvořeno a uloženo.`);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setAiErr(typeof detail === 'string' ? detail : 'AI bio autora se nepodařilo vytvořit.');
    } finally {
      setAiBusyId(null);
    }
  };

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil((total || 0) / limit));

  return (
    <div className="card p-6 space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Umělci</h2>
        <Link to="/admin/artists/new" className="btn btn-primary">+ Nový umělec</Link>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setOffset(0); load(); }} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-sm mb-1">Příjmení</label>
          <input
            className="input"
            value={filterLastname}
            onChange={(e) => {
              setFilterLastname(e.target.value);
              setFilterLetter("");
              setOffset(0);
            }}
            placeholder="např. Anderle"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Na stránku</label>
          <select
            className="input"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value) || 20);
              setOffset(0);
            }}
          >
            {[20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button className="btn" disabled={loading}>
          {loading ? 'Načítám…' : 'Filtrovat'}
        </button>
      </form>
      <div className="flex flex-wrap gap-2 overflow-x-auto py-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            !filterLetter
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/30"
              : "bg-white/70 text-slate-700 hover:bg-slate-900/10 dark:bg-slate-800/70 dark:text-white"
          }`}
          onClick={() => {
            if (filterLetter) {
              setFilterLetter("");
              setOffset(0);
            }
          }}
        >
          Všechna písmena
        </button>
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filterLetter === letter
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/30"
                : "bg-white/80 text-slate-700 hover:bg-slate-900/10 dark:bg-slate-800/70 dark:text-white"
            }`}
            onClick={() => {
              setFilterLetter(letter);
              setFilterLastname("");
              setOffset(0);
            }}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="text-sm text-gray-600">Celkem: {total}</div>
      {aiMsg && <div className="text-sm text-green-700">{aiMsg}</div>}
      {aiErr && <div className="text-sm text-red-600">{aiErr}</div>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Jméno</th>
            <th>Slug</th>
            <th>Děl</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t">
              <td className="py-2">{r.name}</td>
              <td>{r.slug}</td>
              <td>{r.products_count ?? 0}</td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onGenerateArtistBio(r.id)}
                    disabled={aiBusyId === r.id}
                  >
                    {aiBusyId === r.id ? 'AI tvoří bio…' : 'AI bio autora'}
                  </button>
                  <Link to={`/admin/artists/${r.id}`} className="btn">Detail</Link>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-gray-500">
                Zatím žádní umělci.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
