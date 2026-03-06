// apps/admin/src/modules/admin/AdminCoupons.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../shared/adminApiClient";

function Badge({ children, tone = "slate" }) {
  const m = {
    slate: "bg-slate-100 text-slate-800 ring-slate-300",
    green: "bg-emerald-100 text-emerald-800 ring-emerald-300",
    red:   "bg-red-100 text-red-800 ring-red-300",
  }[tone] || "bg-slate-100 text-slate-800 ring-slate-300";
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded ring-1 ${m}`}>
      {children}
    </span>
  );
}

const TYPE_OPTIONS = [
  { value: "percent", label: "percent" },
  { value: "fixed",   label: "fixed" },
];

const CURRENCY_OPTIONS = [
  { value: "CZK", label: "CZK" },
  { value: "EUR", label: "EUR" },
];

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInputDate(dt) {
  if (!dt) return "";
  return String(dt).slice(0, 16);
}

export default function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // Create form
  const [cCode, setCCode] = useState("");
  const [cType, setCType] = useState("percent");
  const [cValue, setCValue] = useState("");
  const [cCurrency, setCCurrency] = useState("CZK");
  const [cMaxUses, setCMaxUses] = useState("");
  const [cPerUser, setCPerUser] = useState("");
  const [cMinTotal, setCMinTotal] = useState("");
  const [cStartsAt, setCStartsAt] = useState("");
  const [cEndsAt, setCEndsAt] = useState("");
  const [cActive, setCActive] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [createInfo, setCreateInfo] = useState("");

  // Edit form
  const [editId, setEditId] = useState(null);
  const [eCode, setECode] = useState("");
  const [eType, setEType] = useState("percent");
  const [eValue, setEValue] = useState("");
  const [eCurrency, setECurrency] = useState("CZK");
  const [eMaxUses, setEMaxUses] = useState("");
  const [ePerUser, setEPerUser] = useState("");
  const [eMinTotal, setEMinTotal] = useState("");
  const [eStartsAt, setEStartsAt] = useState("");
  const [eEndsAt, setEEndsAt] = useState("");
  const [eActive, setEActive] = useState(true);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editInfo, setEditInfo] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/api/admin/v1/coupons/");
      const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setItems(arr);
    } catch {
      setErr("Nepodařilo se načíst kupóny.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalActive = useMemo(
    () => items.filter(c => c.active || c.is_active).length,
    [items]
  );

  function resetCreate() {
    setCCode("");
    setCType("percent");
    setCValue("");
    setCCurrency("CZK");
    setCMaxUses("");
    setCPerUser("");
    setCMinTotal("");
    setCStartsAt("");
    setCEndsAt("");
    setCActive(true);
    setCreateErr("");
    setCreateInfo("");
  }

  function openEdit(c) {
    setEditId(c.id);
    setECode(c.code || "");
    setEType(c.type || "percent");
    setEValue(c.value ?? "");
    setECurrency(c.currency || "CZK");
    setEMaxUses(c.max_uses ?? "");
    setEPerUser(c.per_user_limit ?? "");
    setEMinTotal(c.min_order_total ?? "");
    setEStartsAt(toInputDate(c.starts_at || ""));
    setEEndsAt(toInputDate(c.ends_at || ""));
    setEActive(Boolean(c.active));
    setEditErr("");
    setEditInfo("");
  }

  function cancelEdit() {
    setEditId(null);
    setEditErr("");
    setEditInfo("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateErr("");
    setCreateInfo("");
    if (!cCode.trim() || !cType || cValue === "") {
      setCreateErr("Vyplň kód, typ a hodnotu.");
      return;
    }
    setCreateBusy(true);
    try {
      const payload = {
        code: cCode.trim().toUpperCase(),
        type: cType,
        value: String(numOrNull(cValue) ?? ""),
        currency: cCurrency || null,
        max_uses: numOrNull(cMaxUses),
        per_user_limit: numOrNull(cPerUser),
        min_order_total: cMinTotal === "" ? null : String(numOrNull(cMinTotal) ?? ""),
        starts_at: cStartsAt || null,
        ends_at: cEndsAt || null,
        active: Boolean(cActive),
      };
      await api.post("/api/admin/v1/coupons/", payload);
      setCreateInfo("Vytvořeno.");
      resetCreate();
      await load();
    } catch (ex) {
      const d = ex?.response?.data?.detail;
      setCreateErr(d === "code_exists" ? "Kód již existuje." : (typeof d === "string" ? d : "Vytvoření selhalo."));
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editId) return;
    setEditErr("");
    setEditInfo("");
    setEditBusy(true);
    try {
      const payload = {
        code: eCode.trim() ? eCode.trim().toUpperCase() : undefined,
        type: eType || undefined,
        value: eValue === "" ? undefined : String(numOrNull(eValue) ?? ""),
        currency: eCurrency || undefined,
        max_uses: eMaxUses === "" ? undefined : numOrNull(eMaxUses),
        per_user_limit: ePerUser === "" ? undefined : numOrNull(ePerUser),
        min_order_total: eMinTotal === "" ? undefined : String(numOrNull(eMinTotal) ?? ""),
        starts_at: eStartsAt || undefined,
        ends_at: eEndsAt || undefined,
        active: eActive,
      };
      await api.patch(`/api/admin/v1/coupons/${editId}`, payload);
      setEditInfo("Uloženo.");
      await load();
    } catch (ex) {
      const d = ex?.response?.data?.detail;
      setEditErr(d === "code_exists" ? "Kód již existuje." : (typeof d === "string" ? d : "Uložení selhalo."));
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kupóny</h1>
        <div className="text-sm text-gray-500">
          Aktivní: {totalActive} / {items.length}
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <form onSubmit={handleCreate} className="card p-4 space-y-3">
        <div className="font-medium">Vytvořit nový kupón</div>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs mb-1">Kód *</label>
            <input className="input w-full" value={cCode} onChange={e=>setCCode(e.target.value)} placeholder="NAPR20" required />
          </div>
          <div>
            <label className="block text-xs mb-1">Typ *</label>
            <select className="input w-full" value={cType} onChange={e=>setCType(e.target.value)} required>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Hodnota *</label>
            <input className="input w-full" type="number" step="0.01" value={cValue} onChange={e=>setCValue(e.target.value)} placeholder="10 nebo 100.00" required />
          </div>
          <div>
            <label className="block text-xs mb-1">Měna</label>
            <select className="input w-full" value={cCurrency} onChange={e=>setCCurrency(e.target.value)}>
              {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1">Max uses</label>
            <input className="input w-full" type="number" step="1" min="0" value={cMaxUses} onChange={e=>setCMaxUses(e.target.value)} placeholder="např. 100" />
          </div>
          <div>
            <label className="block text-xs mb-1">Per user limit</label>
            <input className="input w-full" type="number" step="1" min="0" value={cPerUser} onChange={e=>setCPerUser(e.target.value)} placeholder="např. 1" />
          </div>
          <div>
            <label className="block text-xs mb-1">Min. objednávka</label>
            <input className="input w-full" type="number" step="0.01" min="0" value={cMinTotal} onChange={e=>setCMinTotal(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex items-center gap-2">
            <label className="block text-xs">Aktivní</label>
            <input type="checkbox" className="ml-2" checked={cActive} onChange={e=>setCActive(e.target.checked)} />
          </div>

          <div>
            <label className="block text-xs mb-1">Začátek</label>
            <input className="input w-full" type="datetime-local" value={cStartsAt} onChange={e=>setCStartsAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1">Konec</label>
            <input className="input w-full" type="datetime-local" value={cEndsAt} onChange={e=>setCEndsAt(e.target.value)} />
          </div>
        </div>

        {createErr && <div className="text-xs text-red-600">{createErr}</div>}
        {createInfo && <div className="text-xs text-emerald-700">{createInfo}</div>}

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={createBusy}>{createBusy ? "Vytvářím…" : "Vytvořit"}</button>
          <button type="button" className="btn" onClick={resetCreate} disabled={createBusy}>Vyčistit</button>
        </div>
      </form>

      {loading ? (
        <div>Načítám…</div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-3">Kód</th>
                <th className="px-3">Typ</th>
                <th className="px-3">Hodnota</th>
                <th className="px-3">Aktivní</th>
                <th className="px-3">Platnost</th>
                <th className="px-3 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr className="border-t" key={c.id}>
                  <td className="py-2 px-3 font-mono">{c.code}</td>
                  <td className="px-3">{c.type || "—"}</td>
                  <td className="px-3">{c.value ?? "—"}</td>
                  <td className="px-3">
                    <Badge tone={(c.active || c.is_active) ? "green" : "red"}>
                      {(c.active || c.is_active) ? "ANO" : "NE"}
                    </Badge>
                  </td>
                  <td className="px-3">
                    <div className="text-xs text-gray-600">
                      {c.starts_at ? `od ${String(c.starts_at).replace("T"," ").replace("Z","")}` : "—"}
                      {c.ends_at ? `, do ${String(c.ends_at).replace("T"," ").replace("Z","")}` : ""}
                    </div>
                  </td>
                  <td className="px-3 text-right">
                    <button className="btn" onClick={()=>openEdit(c)}>Upravit</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">Žádné kupóny.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editId && (
        <form onSubmit={handleEdit} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Upravit kupón #{editId}</div>
            <button type="button" className="btn" onClick={cancelEdit}>Zavřít</button>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs mb-1">Kód</label>
              <input className="input w-full" value={eCode} onChange={e=>setECode(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1">Typ</label>
              <select className="input w-full" value={eType} onChange={e=>setEType(e.target.value)}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Hodnota</label>
              <input className="input w-full" type="number" step="0.01" value={eValue} onChange={e=>setEValue(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1">Měna</label>
              <select className="input w-full" value={eCurrency} onChange={e=>setECurrency(e.target.value)}>
                {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1">Max uses</label>
              <input className="input w-full" type="number" step="1" min="0" value={eMaxUses} onChange={e=>setEMaxUses(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1">Per user limit</label>
              <input className="input w-full" type="number" step="1" min="0" value={ePerUser} onChange={e=>setEPerUser(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1">Min. objednávka</label>
              <input className="input w-full" type="number" step="0.01" min="0" value={eMinTotal} onChange={e=>setEMinTotal(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-xs">Aktivní</label>
              <input type="checkbox" className="ml-2" checked={eActive} onChange={e=>setEActive(e.target.checked)} />
            </div>

            <div>
              <label className="block text-xs mb-1">Začátek</label>
              <input className="input w-full" type="datetime-local" value={eStartsAt} onChange={e=>setEStartsAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1">Konec</label>
              <input className="input w-full" type="datetime-local" value={eEndsAt} onChange={e=>setEEndsAt(e.target.value)} />
            </div>
          </div>

          {editErr && <div className="text-xs text-red-600">{editErr}</div>}
          {editInfo && <div className="text-xs text-emerald-700">{editInfo}</div>}

          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={editBusy}>{editBusy ? "Ukládám…" : "Uložit změny"}</button>
            <button type="button" className="btn" onClick={cancelEdit} disabled={editBusy}>Zrušit</button>
          </div>
        </form>
      )}
    </div>
  );
}
