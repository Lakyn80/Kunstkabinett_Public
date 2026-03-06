// src/modules/admin/UserDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from "../../shared/adminApiClient";

function fmtCurrencyCZ(amount, currency = 'CZK') {
  if (amount == null) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  try { return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
}

/* Normalizace booleans z API */
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 't' || s === '1' || s === 'yes';
  }
  return undefined; // důležité: "není definováno" ≠ false
}
function pickIsCorporate(u) {
  if (!u || typeof u !== 'object') return undefined;
  if ('is_corporate' in u) return toBool(u.is_corporate);
  if ('isCorporate' in u)   return toBool(u.isCorporate);
  return undefined;
}

/* Perzistence UI příznaku korporátu přes odhlášení/přihlášení */
function corpKey(userId) {
  return `corp_flag:${String(userId)}`;
}
function getCachedCorpFlag(userId) {
  try {
    const v = localStorage.getItem(corpKey(userId));
    if (v == null) return undefined;
    return v === '1';
  } catch { return undefined; }
}
function setCachedCorpFlag(userId, valBool) {
  try {
    if (typeof valBool !== 'boolean') return;
    localStorage.setItem(corpKey(userId), valBool ? '1' : '0');
  } catch {}
}

export default function UserDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState({ billing: null, shipping: null });
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // zdroj pro zobrazení stavu vždy UI state `corp`
  const [corp, setCorp] = useState(false);
  const [savingCorp, setSavingCorp] = useState(false);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      // 1) čistý user
      const ures = await api.get(`/api/admin/v1/users/${id}?t=${Date.now()}`);
      const u = ures.data || null;
      setUser(u);

      // 1a) nastav corp: preferuj jasnou hodnotu z API, jinak cache
      const apiCorp = pickIsCorporate(u);
      if (typeof apiCorp === 'boolean') {
        setCorp(apiCorp);
        setCachedCorpFlag(u?.id ?? id, apiCorp);
      } else {
        const cached = getCachedCorpFlag(u?.id ?? id);
        if (typeof cached === 'boolean') setCorp(cached);
      }

      // 2) rozšířená data
      try {
        const fres = await api.get(`/api/admin/v1/users/${id}/full?t=${Date.now()}`);
        setProfile(fres.data?.profile || null);
        setAddresses(fres.data?.addresses || { billing: null, shipping: null });
        setOrders(Array.isArray(fres.data?.orders) ? fres.data.orders : []);
      } catch {
        setProfile(null);
        setAddresses({ billing: null, shipping: null });
        setOrders([]);
      }
    } catch {
      setErr('Nepodařilo se načíst uživatele.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id]);

  async function saveCorporate() {
    if (!user) return;
    setSavingCorp(true);
    try {
      await api.patch(`/api/admin/v1/users/${user.id}/corporate`, { is_corporate: !!corp });
      // optimistic update + cache
      setUser(u => (u ? { ...u, is_corporate: !!corp } : u));
      setCachedCorpFlag(user.id, !!corp);
    } catch {
      alert('Uložení příznaku „Korporát“ selhalo.');
    } finally {
      setSavingCorp(false);
    }
  }

  if (loading) return <div className="card p-6"><div>Načítám…</div></div>;

  if (err) {
    return (
      <div className="card p-6 space-y-3">
        <div className="text-red-600">{err}</div>
        <div><button className="btn" onClick={() => nav(-1)}>Zpět</button></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card p-6">
        <div className="text-gray-600">Uživatel nenalezen.</div>
        <div className="mt-3"><button className="btn" onClick={() => nav(-1)}>Zpět</button></div>
      </div>
    );
  }

  const Addr = ({ title, a }) => (
    <div className="p-4 rounded border bg-white space-y-1">
      <div className="text-sm text-gray-500">{title}</div>
      {!a ? (
        <div className="text-gray-500 text-sm">—</div>
      ) : (
        <div className="text-sm leading-5">
          <div>
            {a.full_name ||
             a.fullname ||
             [a.first_name, a.last_name].filter(Boolean).join(' ') ||
             '—'}
          </div>
          {a.company && <div>{a.company}</div>}
          {a.address ? (
            <div>{a.address}</div>
          ) : (
            <>
              <div>
                {(a.address_line1 || a.line1 || '—')}
                {(a.address_line2 || a.line2) ? `, ${a.address_line2 || a.line2}` : ''}
              </div>
              <div>
                {[a.zip || a.postal_code, a.city].filter(Boolean).join(' ')}
                {a.country ? `, ${a.country}` : ''}
              </div>
            </>
          )}
          {a.phone && <div>Tel.: {a.phone}</div>}
          {(a.email || user.email) && <div>E-mail: {a.email || user.email}</div>}
          {a.ico && <div>IČO: {a.ico}</div>}
          {a.dic && <div>DIČ: {a.dic}</div>}
        </div>
      )}
    </div>
  );

  const billing = addresses?.billing || profile || null;
  const shipping = addresses?.shipping || profile || null;

  const isCorp = !!corp;

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Profil uživatele #{user.id}</h1>
          <span
            className={
              "px-3 py-1 rounded-full text-xs font-semibold ring-1 " +
              (isCorp
                ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                : "bg-gray-100 text-gray-800 ring-gray-300")
            }
            title={isCorp ? "Korporátní zákazník" : "Retail zákazník"}
          >
            {isCorp ? "KORPORÁT" : "RETAIL"}
          </span>
        </div>
        <Link to="/admin/users" className="btn">← Zpět na seznam</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-4 rounded border bg-white space-y-3">
          <div>
            <div className="text-sm text-gray-500">E-mail</div>
            <div className="font-medium break-all">{user.email}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Role</div>
            <div className="inline-block px-2 py-1 rounded bg-gray-100 text-gray-800">
              {user.role}
            </div>
          </div>

          {/* Typ zákazníka podle UI stavu */}
          <div className="mt-2">
            <div className="text-sm text-gray-500">Typ zákazníka</div>
            <div
              className={
                "inline-block px-2 py-1 rounded text-sm font-medium ring-1 " +
                (isCorp
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-gray-50 text-gray-700 ring-gray-200")
              }
            >
              {isCorp ? 'Korporát' : 'Retail'}
            </div>
          </div>

          {/* Přepínač + uložení */}
          <div className="pt-2 border-t">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={corp}
                onChange={(e) => setCorp(e.target.checked)}
                disabled={savingCorp}
              />
              <span>Korporát</span>
            </label>
            <div className="mt-2">
              <button className="btn" onClick={saveCorporate} disabled={savingCorp}>
                {savingCorp ? 'Ukládám…' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>

        <Addr title="Fakturační adresa" a={billing} />
        <Addr title="Doručovací adresa" a={shipping} />
      </div>

      <div className="p-4 rounded border bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Objednávky uživatele</h2>
          <div className="text-sm text-gray-500">Celkem: {orders.length}</div>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">ID</th>
                <th>Status</th>
                <th>Platba</th>
                <th>Doprava</th>
                <th>Vytvořeno</th>
                <th className="text-right">Celkem</th>
                <th className="text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="py-2">{o.id}</td>
                  <td>{o.status}</td>
                  <td>{o.payment_method ?? '—'}</td>
                  <td>{o.shipping_method ?? '—'}</td>
                  <td className="font-mono tabular-nums">{o.created_at ?? '—'}</td>
                  <td className="text-right">{fmtCurrencyCZ(o.total)}</td>
                  <td className="text-right">
                    <Link className="btn" to={`/admin/orders/${o.id}`}>Detail</Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">Žádné objednávky.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
