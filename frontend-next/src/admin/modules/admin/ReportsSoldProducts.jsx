import { useEffect, useMemo, useState } from 'react';
import api, { backendUrl } from "../../shared/adminApiClient";
import { Link } from 'react-router-dom';

function fmtCurrencyCZ(amount, currency = 'CZK') {
  if (amount == null) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  try { return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(n); }
  catch { return `${n.toFixed(2)} Kč`; }
}

export default function ReportsSoldProducts() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [sort, setSort] = useState('qty');
  const [order, setOrder] = useState('desc');

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [info, setInfo] = useState('');

  const [detailModal, setDetailModal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const params = useMemo(() => {
    const p = {
      status_filter: 'paid',
      sort,
      order,
      limit,
      offset,
    };
    if (since) p.since = new Date(`${since}T00:00:00`).toISOString();
    if (until) p.until = new Date(`${until}T00:00:00`).toISOString();
    return p;
  }, [since, until, sort, order, limit, offset]);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get('/api/admin/v1/reports/sold-products', { params });
      setRows(data?.items || []);
      setTotal(Number(data?.total || 0));
    } catch (e) {
      const status = e?.response?.status ?? 0;
      let msg = 'Nepodařilo se načíst report.';
      if (status === 401) msg = 'Nejprve se přihlas.';
      if (status === 403) msg = 'Tento report je jen pro administrátory.';
      setErr(msg);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);

  const onFilter = (e) => {
    e?.preventDefault?.();
    setOffset(0);
    load();
  };

  const changePage = (dir) => {
    if (dir === 'prev' && offset > 0) setOffset((o) => Math.max(0, o - limit));
    if (dir === 'next' && page < pages) setOffset((o) => o + limit);
  };

  const totalQty = useMemo(() => rows.reduce((s, r) => s + (Number(r.qty_sold) || 0), 0), [rows]);
  const totalRevenue = useMemo(() => rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0), [rows]);

  const loadProductDetail = async (productId) => {
    setDetailLoading(true);
    setDetailData(null);
    try {
      const { data } = await api.get(
        `/api/admin/v1/reports/sold-products/${productId}/orders`,
        {
          params: {
            since: since ? new Date(`${since}T00:00:00`).toISOString() : undefined,
            until: until ? new Date(`${until}T00:00:00`).toISOString() : undefined,
          }
        }
      );

      setDetailData({
        productId: data.product_id,
        orders: data.orders || []
      });
    } catch (e) {
      const status = e?.response?.status ?? 0;
      let msg = 'Nepodařilo se načíst detail objednávek.';
      if (status === 401) msg = 'Nejprve se přihlas.';
      if (status === 403) msg = 'Nemáš oprávnění k tomuto detailu.';
      setErr(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = (productId, productTitle) => {
    setDetailModal({ productId, productTitle });
    if (productId) loadProductDetail(productId);
  };

  const closeDetail = () => {
    setDetailModal(null);
    setDetailData(null);
    setErr('');
    setInfo('');
  };

  const openInvoicePdf = async (orderId) => {
    setErr('');
    setInfo('');
    try {
      const token = localStorage.getItem('am_admin_token') || '';
      const res = await fetch(backendUrl(`/api/admin/v1/invoices/${orderId}.pdf`), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf'
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Chyba ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErr('Nepodařilo se stáhnout/otevřít PDF fakturu.');
    }
  };

  const sendInvoiceEmail = async (orderId) => {
    setErr('');
    setInfo('');
    const to = window.prompt('Zadej e-mail, na který odeslat fakturu:');
    if (!to) return;
    try {
      await api.post(`/api/admin/v1/orders/${orderId}/send-invoice`, { to });
      setInfo(`Faktura pro objednávku #${orderId} byla odeslána na ${to}`);
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Odeslání faktury selhalo.');
    }
  };

  const buildQueryString = () => {
    const q = new URLSearchParams();
    q.set('status_filter', 'paid');
    if (since) q.set('since', new Date(`${since}T00:00:00`).toISOString());
    if (until) q.set('until', new Date(`${until}T00:00:00`).toISOString());
    q.set('sort', sort);
    q.set('order', order);
    return q.toString();
  };

  const buildFileName = (ext) => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const s = since || 'any';
    const u = until || 'any';
    return `sold_products_paid_${s}_${u}_${sort}_${order}_${ts}.${ext}`;
  };

  const downloadFile = async (format) => {
    setDownloading(true);
    setErr('');
    try {
      const qs = buildQueryString();
      const url = backendUrl(`/api/admin/v1/reports/sold-products.${format}?${qs}`);

      const token = localStorage.getItem('am_admin_token') || '';
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Accept: format === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Nejprve se přihlas.');
        if (res.status === 403) throw new Error('Tento export je jen pro administrátory.');
        const txt = await res.text().catch(() => '');
        throw new Error(`Chyba exportu (${res.status}): ${txt || res.statusText}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/i.exec(cd);
      const fileName = m?.[1] || buildFileName(format);

      const link = document.createElement('a');
      const href = URL.createObjectURL(blob);
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      setErr(e?.message || 'Export selhal.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Prodané produkty</h1>
          <p className="text-sm text-gray-600 mt-1">Pouze objednávky se statusem <b>paid</b></p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => downloadFile('csv')} disabled={downloading} title="Stáhnout jako CSV">
            {downloading ? 'Připravuji…' : 'Stáhnout CSV'}
          </button>
          <button className="btn" onClick={() => downloadFile('xlsx')} disabled={downloading} title="Stáhnout jako Excel (XLSX)">
            {downloading ? 'Připravuji…' : 'Stáhnout Excel'}
          </button>
          <Link to="/admin" className="btn">← Zpět na dashboard</Link>
        </div>
      </div>

      <form onSubmit={onFilter} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm mb-1">Od (včetně)</label>
          <input type="date" className="input" value={since} onChange={(e) => setSince(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Do (exkluzivně)</label>
          <input type="date" className="input" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Řadit podle</label>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="qty">Počet ks</option>
            <option value="revenue">Tržba</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Pořadí</label>
          <select className="input" value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">Sestupně</option>
            <option value="asc">Vzestupně</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Na stránku</label>
          <select
            className="input"
            value={limit}
            onChange={(e) => {
              const v = Number(e.target.value) || 50;
              setLimit(v);
              setOffset(0);
            }}
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Načítám…' : 'Filtrovat'}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between text-sm text-gray-700">
        <div>Celkem položek: {total}</div>
        <div className="flex items-center gap-4">
          <div>Součet ks (na této stránce): <b>{totalQty}</b></div>
          <div>Součet tržeb (na této stránce): <b>{fmtCurrencyCZ(totalRevenue)}</b></div>
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}
      {info && <div className="text-green-700 text-sm">{info}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr>
              <th className="py-2">Product ID</th><th>Název</th><th>Autor</th><th className="text-right">Ks prodáno</th><th className="text-right">Tržba</th><th className="text-center">Akce</th></tr>
          </thead><tbody>
            {rows.map((r) => (
              <tr key={r.product_id ?? r.title} className="border-t"><td className="py-2">{r.product_id ?? '—'}</td><td>{r.title || '(bez názvu)'}</td><td className="text-gray-600">{r.artist_name || '—'}</td><td className="text-right">{r.qty_sold}</td><td className="text-right">{fmtCurrencyCZ(r.revenue)}</td><td className="text-center">
                  <button className="btn btn-sm" onClick={() => openDetail(r.product_id, r.title)} disabled={!r.product_id} title="Zobrazit detail objednávek">
                    Detail
                  </button>
                </td></tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">Žádná data pro zvolené filtry.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-700">
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

      {detailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeDetail}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Detail objednávek</h2>
                <p className="text-sm text-gray-600">
                  Produkt: <b>{detailModal.productTitle}</b> (ID: {detailModal.productId})
                </p>
              </div>
              <button onClick={closeDetail} className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 font-bold" title="Zavřít">✕</button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {detailLoading && <p>Načítám objednávky…</p>}
              {!detailLoading && detailData && (
                <>
                  <p className="mb-4 text-sm">
                    Celkem objednávek (paid): <b>{detailData.orders.length}</b>
                  </p>
                  {detailData.orders.length === 0 ? (
                    <p className="text-gray-500">Žádné zaplacené objednávky s tímto produktem.</p>
                  ) : (
                    <div className="space-y-4">
                      {detailData.orders.map((order) => (
                        <div key={order.id} className="border rounded p-3 bg-gray-50">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium">Objednávka #{order.id}</div>
                              <div className="text-sm text-gray-600">Celkem: {fmtCurrencyCZ(order.total)}</div>
                              {(order.payment_method || order.shipping_method) && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Platba: {order.payment_method || '—'} | Doprava: {order.shipping_method || '—'}
                                </div>
                              )}
                            </div>
                            <div className="text-right text-sm">
                              <div>Status: <b>{order.status}</b></div>
                              {order.created_at && (
                                <div className="text-gray-600">
                                  {new Date(order.created_at).toLocaleDateString('cs-CZ')}
                                </div>
                              )}
                            </div>
                          </div>
                          {Array.isArray(order.items) && order.items.length > 0 && (
                            <div className="mt-2 pt-2 border-t text-sm space-y-1">
                              {order.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center justify-between ${
                                    item.product_id === detailModal.productId
                                      ? 'font-semibold bg-yellow-50 -mx-2 px-2 py-1 rounded'
                                      : ''
                                  }`}
                                >
                                  <span>{item.title || '(bez názvu)'}</span>
                                  <span className="ml-4 whitespace-nowrap">
                                    {item.qty}× {fmtCurrencyCZ(item.unit_price)} = {fmtCurrencyCZ(item.qty * item.unit_price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 pt-2 border-t flex gap-2">
                            <button className="btn btn-sm" onClick={() => openInvoicePdf(order.id)} title="Náhled PDF faktury">
                              Náhled PDF
                            </button>
                            <button className="btn btn-sm" onClick={() => sendInvoiceEmail(order.id)} title="Poslat fakturu e-mailem">
                              Poslat e-mailem
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t flex justify-end flex-shrink-0">
              <button onClick={closeDetail} className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50">Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
