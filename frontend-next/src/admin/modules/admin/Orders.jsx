// apps/admin/src/modules/admin/Orders.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { backendUrl } from "../../shared/adminApiClient";

function fmtMoney(n, currency = "CZK") {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat("cs-CZ", { style: "currency", currency }).format(num);
  } catch {
    const suffix = currency === "EUR" ? "€" : currency === "USD" ? "$" : "Kč";
    return `${num.toFixed(2)} ${suffix}`;
  }
}

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState("");
  const [qUserId, setQUserId] = useState("");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const params = useMemo(() => {
    const p = { limit, offset };
    if (status) p.status_filter = status;
    if (qUserId) p.user_id = Number(qUserId) || undefined;
    return p;
  }, [status, qUserId, limit, offset]);

  const load = async () => {
    setLoading(true);
    setErr("");
    setInfo("");
    try {
      const { data } = await api.get("/api/admin/v1/orders/", { params });
      setRows(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // eslint-disable-next-line
  }, []);
  useEffect(() => {
    load(); // eslint-disable-next-line
  }, [params]);

  const changePage = (dir) => {
    if (dir === "prev" && offset > 0) setOffset((o) => Math.max(0, o - limit));
    if (dir === "next" && page < pages) setOffset((o) => o + limit);
  };

  // ---- FA náhled (PDF)
  const openInvoicePdf = async (orderId) => {
    setErr("");
    setInfo("");
    try {
      const token = localStorage.getItem("am_admin_token") || "";
      const res = await fetch(backendUrl(`/api/admin/v1/invoices/${orderId}.pdf`), {
        method: "GET",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          Accept: "application/pdf",
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Chyba ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErr("Nepodařilo se otevřít PDF fakturu.");
    }
  };

  // ---- FA odeslání e-mailem
  const sendInvoiceEmail = async (orderId) => {
    setErr("");
    setInfo("");
    const to = window.prompt("Zadej e-mail, na který odeslat fakturu:");
    if (!to) return;
    try {
      await api.post(`/api/admin/v1/orders/${orderId}/send-invoice`, { to });
      setInfo(`Faktura pro objednávku #${orderId} byla odeslána na ${to}`);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Odeslání faktury selhalo.");
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Objednávky</h1>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          load();
        }}
      >
        <div>
          <label className="block text-sm mb-1">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">(vše)</option>
            <option value="draft">draft</option>
            <option value="pending_payment">pending_payment</option>
            <option value="paid">paid</option>
            <option value="shipped">shipped</option>
            <option value="canceled">canceled</option>
            <option value="reklamace">reklamace</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">User ID</label>
          <input className="input w-32" value={qUserId} onChange={(e) => setQUserId(e.target.value)} placeholder="např. 12" />
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
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" disabled={loading}>
          {loading ? "Načítám…" : "Filtrovat"}
        </button>
      </form>

      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
      {info && <div className="text-sm text-green-700 mb-2">{info}</div>}

      <div className="text-sm text-gray-600 mb-2">Celkem: {total}</div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">ID</th>
              <th>Status</th>
              <th>Uživatel</th>
              <th>Položky</th>
              <th>Autoři</th>
              <th className="text-right">Celkem</th>
              <th className="text-right">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">{r.id}</td>
                <td>{r.status}</td>
                <td>{r.user_email || r.user_id || "—"}</td>
                <td>{r.items_count ?? "—"}</td>
                <td>{r.artists_str || "—"}</td>
                <td className="text-right">{fmtMoney(r.total, r.currency || "CZK")}</td>
                <td className="text-right">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Link className="btn" to={`/admin/orders/${r.id}`}>Detail</Link>
                    <button className="btn" onClick={() => openInvoicePdf(r.id)} title="Náhled PDF faktury">
                      Faktura PDF
                    </button>
                    <button className="btn" onClick={() => sendInvoiceEmail(r.id)} title="Poslat fakturu e-mailem">
                      Poslat FA
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Žádné objednávky.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <div>
          Strana {page} / {pages}
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => changePage("prev")} disabled={loading || offset === 0}>
            ◀ Předchozí
          </button>
          <button className="btn" onClick={() => changePage("next")} disabled={loading || page >= pages}>
            Další ▶
          </button>
        </div>
      </div>
    </div>
  );
}
