// apps/admin/src/modules/admin/OrderDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../shared/adminApiClient";

function fmtCurrency(amount, currency = "CZK") {
  if (amount == null) return "-";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "-";
  try {
    return new Intl.NumberFormat("cs-CZ", { style: "currency", currency }).format(n);
  } catch {
    const suffix = currency === "EUR" ? "€" : currency === "USD" ? "$" : "Kč";
    return `${n.toFixed(2)} ${suffix}`;
  }
}

function addressLines(addr, fallbackEmail) {
  if (!addr) return ["-"];
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ");
  const line1 = addr.street || "";
  const line2 = [addr.postal_code, addr.city].filter(Boolean).join(" ");
  const line3 = addr.country || "";
  const lines = [name, line1, line2, line3].filter(Boolean);
  if (addr.phone) lines.push(`Tel.: ${addr.phone}`);
  const email = addr.email || fallbackEmail;
  if (email) lines.push(`E-mail: ${email}`);
  return lines.length ? lines : ["-"];
}

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [newStatus, setNewStatus] = useState("pending_payment");
  const [reason, setReason] = useState("");
  const [addresses, setAddresses] = useState({ billing: null, shipping: null });

  const load = async () => {
    setLoading(true);
    setErr("");
    setInfo("");
    try {
      const { data } = await api.get(`/api/admin/v1/orders/${id}`);
      setOrder(data);
      setNewStatus(data?.status || "pending_payment");
      if (data?.user_id) {
        try {
          const { data: udata } = await api.get(`/api/admin/v1/users/${data.user_id}/full`);
          setAddresses(udata?.addresses || { billing: null, shipping: null });
        } catch {
          setAddresses({ billing: null, shipping: null });
        }
      } else {
        setAddresses({ billing: null, shipping: null });
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Nepodařilo se načíst objednávku.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitStatus = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    try {
      await api.post(`/api/admin/v1/orders/${id}/status`, {
        status: newStatus,
        reason: reason || null,
      });
      setInfo("Status upraven.");
      setReason("");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Změna statusu selhala.");
    }
  };

  const items = useMemo(() => order?.items || [], [order]);
  const shipping = addresses?.shipping || null;

  if (loading && !order) return <div className="card p-6">Načítám…</div>;
  if (err && !order) return <div className="card p-6 text-red-600">{err}</div>;
  if (!order) return <div className="card p-6">Objednávka nenalezena.</div>;

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Objednávka #{order.id}</h1>
        <Link to="/admin/orders" className="btn">← Zpět na seznam</Link>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}
      {info && <div className="text-green-700 text-sm">{info}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div><b>Status</b></div>
          <div className="text-sm">{order.status || "—"}</div>

          <div className="mt-4"><b>Platba</b></div>
          <div className="text-sm">{order.payment_method || "—"}</div>

          <div className="mt-4"><b>Doprava</b></div>
          <div className="text-sm">{order.shipping_method || "—"}</div>

          <div className="mt-4"><b>Doručovací adresa</b></div>
          <div className="text-sm space-y-1">
            {addressLines(shipping, order.user_email).map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>

          <div className="mt-4"><b>Celkem</b></div>
          <div className="text-sm">{fmtCurrency(order.total, order.currency || "CZK")}</div>
        </div>

        <form onSubmit={submitStatus} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Změnit status</label>
            <select
              className="input"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="draft">draft</option>
              <option value="pending_payment">pending_payment</option>
              <option value="paid">paid</option>
              <option value="shipped">shipped</option>
              <option value="canceled">canceled</option>
              <option value="reklamace">reklamace</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Důvod změny (volitelné)</label>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Např. omylem zrušeno, oprava…"
            />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Ukládám…" : "Uložit"}
          </button>
        </form>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Položky</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Název</th>
                <th>Autor</th>
                <th>Množství</th>
                <th className="text-right">Cena</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const priceCandidate =
                  it.unit_price ??
                  (Number.isFinite(Number(it.line_total)) && it.qty
                    ? Number(it.line_total) / Number(it.qty)
                    : null);
                return (
                  <tr key={it.id} className="border-t">
                    <td className="py-2">{it.product_title || "—"}</td>
                    <td>{it.artist_name || "—"}</td>
                    <td>{it.qty}</td>
                    <td className="text-right">{fmtCurrency(priceCandidate, order.currency || "CZK")}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    Žádné položky.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-500">
          Údaje o autorovi jsou pouze pro zobrazení; v objednávce se needitují.
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Historie změn statusu</div>
        {(order.status_history || []).length === 0 ? (
          <div className="text-sm text-gray-500">Zatím žádné záznamy.</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {order.status_history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline gap-2">
                <span className="text-gray-500">
                  {(h.created_at || "").replace("T", " ").replace("Z", "")}
                </span>
                <span>
                  {h.from_status} → <b>{h.to_status}</b>
                </span>
                {h.reason && <span className="text-gray-600 italic">— {h.reason}</span>}
                {h.changed_by_user_email && (
                  <span className="text-gray-500">({h.changed_by_user_email})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
