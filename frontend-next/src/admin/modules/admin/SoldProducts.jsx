// src/modules/admin/SoldProducts.jsx
import { useEffect, useMemo, useState } from "react";
import api, { backendUrl } from "../../shared/adminApiClient";

function toISOorNull(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString();
  } catch {
    return null;
  }
}

export default function SoldProducts() {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState("paid");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [sort, setSort] = useState("qty");
  const [order, setOrder] = useState("desc");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [err, setErr] = useState("");

  const params = useMemo(
    () => ({
      status_filter: statusFilter || "paid",
      since: toISOorNull(since),
      until: toISOorNull(until),
      sort,
      order,
      limit,
      offset,
    }),
    [statusFilter, since, until, sort, order, limit, offset]
  );

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/api/admin/v1/reports/sold-products", { params });
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      const s = e?.response?.status;
      setErr(s === 401 ? "Nejprve se přihlas." : s === 403 ? "Jen pro administrátory." : "Načtení selhalo.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status_filter, params.since, params.until, params.sort, params.order, params.limit, params.offset]);

  const buildQueryString = () => {
    const q = new URLSearchParams();
    if (params.status_filter) q.set("status_filter", params.status_filter);
    if (params.since) q.set("since", params.since);
    if (params.until) q.set("until", params.until);
    if (params.sort) q.set("sort", params.sort);
    if (params.order) q.set("order", params.order);
    return q.toString();
  };

  const buildFileNameFallback = (ext) => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const s = since || "any";
    const u = until || "any";
    return `sold_products_${statusFilter || "paid"}_${s}_${u}_${sort}_${order}_${ts}.${ext}`;
  };

  async function downloadFile(format) {
    setDownloading(true);
    setErr("");
    try {
      const qs = buildQueryString();
      const url = backendUrl(`/api/admin/v1/reports/sold-products.${format}?${qs}`);
      const token = localStorage.getItem("am_admin_token") || "";

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          Accept:
            format === "csv"
              ? "text/csv"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Nejprve se přihlas.");
        if (res.status === 403) throw new Error("Jen pro administrátory.");
        const txt = await res.text().catch(() => "");
        throw new Error(`Export selhal (${res.status}) ${txt || res.statusText}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/i.exec(cd);
      const fileName = m?.[1] || buildFileNameFallback(format);

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      setErr(e?.message || "Export selhal.");
    } finally {
      setDownloading(false);
    }
  }

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Prodané produkty</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => downloadFile("csv")} disabled={downloading}>
            {downloading ? "Připravuji…" : "Export CSV"}
          </button>
          <button className="btn" onClick={() => downloadFile("xlsx")} disabled={downloading}>
            {downloading ? "Připravuji…" : "Export XLSX"}
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="card p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm mb-1">Status</label>
          <input
            className="input w-full"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="např. paid,shipped"
          />
          <div className="text-xs text-gray-500 mt-1">CSV statusů, default „paid“</div>
        </div>

        <div>
          <label className="block text-sm mb-1">Od (since)</label>
          <input className="input w-full" type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Do (until)</label>
          <input className="input w-full" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm mb-1">Řazení</label>
          <div className="flex gap-2">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="qty">qty</option>
              <option value="revenue">revenue</option>
            </select>
            <select className="input" value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="desc">desc</option>
              <option value="asc">asc</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Stránkování</label>
          <div className="flex gap-2">
            <input
              className="input w-20"
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value) || 50);
                setOffset(0);
              }}
            />
            <div className="flex gap-2">
              <button className="btn" disabled={!canPrev} onClick={() => setOffset(Math.max(0, offset - limit))}>
                ←
              </button>
              <button className="btn" disabled={!canNext} onClick={() => setOffset(offset + limit)}>
                →
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Celkem: {total} &nbsp;|&nbsp; Zobrazeno: {rows.length}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-medium">Product ID</th>
              <th className="p-3 font-medium">Název</th>
              <th className="p-3 font-medium">Prodáno (qty)</th>
              <th className="p-3 font-medium">Tržby (revenue)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={4}>Načítám…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={4}>Žádná data.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.product_id}-${r.title}`}>
                  <td className="p-3">{r.product_id ?? "—"}</td>
                  <td className="p-3">{r.title}</td>
                  <td className="p-3">{r.qty_sold}</td>
                  <td className="p-3">
                    {Number(r.revenue).toLocaleString("cs-CZ", { style: "currency", currency: "CZK" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
