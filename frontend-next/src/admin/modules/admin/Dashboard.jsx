// apps/admin/src/modules/admin/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../shared/adminApiClient";

/* helpers */
function startOfCalendarMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function endOfCalendarMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function toLocalIso(dt){ const p=(n)=>String(n).padStart(2,"0"); return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`; }
function formatCZK(n){
  try { return new Intl.NumberFormat("cs-CZ",{style:"currency",currency:"CZK"}).format(n||0); }
  catch { return `${(Number(n)||0).toFixed(2)} Kč`; }
}

function BarChart({ data, height = 180, padding = 16 }) {
  const max = Math.max(1, ...data.map(d => Number(d.value) || 0));
  const barW = 40, gap = 16, width = padding*2 + data.length*barW + (data.length-1)*gap, chartH = height - padding*2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
      {data.map((d,i)=> {
        const val = Number(d.value)||0, h = Math.round((val/max)*(chartH-20)), x = padding + i*(barW+gap), y = height - padding - h;
        return (
          <g key={d.label+i} transform={`translate(${x},0)`}>
            <rect x={0} y={y} width={barW} height={h} rx="8" fill="#111827" opacity="0.85" />
            <text x={barW/2} y={height - padding + 12} textAnchor="middle" fontSize="9" fill="#6b7280">{d.label}</text>
            <title>{val}</title>
          </g>
        );
      })}
    </svg>
  );
}

function useTotals() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [artists, setArtists] = useState(0);
  const [products, setProducts] = useState(0);
  const [posts, setPosts] = useState(0);
  const [coupons, setCoupons] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const qs = { limit: 1, offset: 0 };
        const [a, p, b, c] = await Promise.all([
          api.get("/api/admin/v1/artists/", { params: qs }),
          api.get("/api/admin/v1/products/", { params: qs }),
          api.get("/api/admin/v1/blog/", { params: qs }),
          api.get("/api/admin/v1/coupons/", { params: qs }),
        ]);
        if (!mounted) return;
        const tot = (res) =>
          Number(res?.data?.total ??
            (Array.isArray(res?.data?.items) ? res.data.items.length :
             Array.isArray(res?.data) ? res.data.length : 0));
        setArtists(tot(a)); setProducts(tot(p)); setPosts(tot(b)); setCoupons(tot(c));
      } catch { if (!mounted) return; setErr("Nepodařilo se načíst přehled."); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  return { loading, err, artists, products, posts, coupons };
}

export default function Dashboard() {
  const { loading: tl, err: terr, artists, products, posts, coupons } = useTotals();

  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesErr, setSeriesErr] = useState("");
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [ordersSeries, setOrdersSeries] = useState([]);
  const [totRevenue, setTotRevenue] = useState(0);
  const [totOrders, setTotOrders] = useState(0);

  const since = startOfCalendarMonth(new Date());
  const until = endOfCalendarMonth(new Date());
  const sinceIso = toLocalIso(since);
  const untilIso = toLocalIso(until);

  useEffect(() => {
    let mounted = true;

    async function fetchTimeseries() {
      setSeriesLoading(true); setSeriesErr("");

      const days = []; { const d = new Date(since); while (d <= until) { days.push(new Date(d)); d.setDate(d.getDate()+1);} }
      const labels = days.map(d=>d.getDate());

      try {
        const qs = { since: sinceIso, until: untilIso, bucket: "day", status_filter: "paid" };
        const rep = await api.get("/api/admin/v1/reports/orders-timeseries", { params: qs });

        const revMap = new Map(), ordMap = new Map();
        const rev = rep?.data?.series?.revenue ?? [];
        const ord = rep?.data?.orders ?? rep?.data?.series?.orders ?? [];
        rev.forEach(p=>{ const dd=new Date(p.date); revMap.set(dd.toDateString(), Number(p.value)||0); });
        ord.forEach(p=>{ const dd=new Date(p.date); ordMap.set(dd.toDateString(), Number(p.value)||0); });

        const revSeries = days.map((d,i)=>({ label:String(labels[i]), value: revMap.get(d.toDateString())||0 }));
        const ordSeries = days.map((d,i)=>({ label:String(labels[i]), value: ordMap.get(d.toDateString())||0 }));

        if (!mounted) return;
        setRevenueSeries(revSeries); setOrdersSeries(ordSeries);

        const tr = Number(rep?.data?.totals?.revenue) || revSeries.reduce((s,x)=>s+(Number(x.value)||0),0);
        const to = Number(rep?.data?.totals?.orders) || ordSeries.reduce((s,x)=>s+(Number(x.value)||0),0);

        setTotRevenue(tr); setTotOrders(to); setSeriesLoading(false);
        return;
      } catch {}

      try {
        const params = { status_filter: "paid", limit: 200, offset: 0, since: sinceIso, until: untilIso };
        const res = await api.get("/api/admin/v1/orders/", { params });
        const items = Array.isArray(res?.data?.items) ? res.data.items : res?.data || [];
        const byDay = new Map();
        items.forEach(o=>{
          const d = o.created_at ? new Date(o.created_at) : null; if (!d) return;
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          const entry = byDay.get(key) || { revenue:0, count:0 };
          entry.revenue += Number(o.total)||0; entry.count += 1; byDay.set(key, entry);
        });

        const revSeries = days.map((d,i)=>{ const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const e=byDay.get(key); return { label:String(labels[i]), value:e?e.revenue:0 }; });
        const ordSeries = days.map((d,i)=>{ const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const e=byDay.get(key); return { label:String(labels[i]), value:e?e.count:0 }; });

        if (!mounted) return;
        setRevenueSeries(revSeries); setOrdersSeries(ordSeries);
        setTotRevenue(revSeries.reduce((s,x)=>s+(Number(x.value)||0),0));
        setTotOrders(ordSeries.reduce((s,x)=>s+(Number(x.value)||0),0));
        setSeriesLoading(false);
      } catch {
        if (!mounted) return;
        setSeriesErr("Nepodařilo se načíst metriky (zkontroluj token / API).");
        setSeriesLoading(false);
      }
    }

    fetchTimeseries();
    return () => { mounted = false; };
  }, [sinceIso, untilIso]);

  const monthTitle = useMemo(() => {
    const m = since.toLocaleString("cs-CZ", { month: "long" });
    return `${m.charAt(0).toUpperCase() + m.slice(1)} ${since.getFullYear()}`;
  }, [sinceIso]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Přehled</h1>
        <p className="text-sm text-gray-600">Souhrn obsahu a prodejů — {monthTitle}</p>
        {terr && <div className="text-sm text-red-600">{terr}</div>}
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4"><div className="text-sm text-gray-500">Umělci</div><div className="text-3xl font-semibold">{tl ? "…" : artists}</div></div>
        <div className="card p-4"><div className="text-sm text-gray-500">Díla</div><div className="text-3xl font-semibold">{tl ? "…" : products}</div></div>
        <div className="card p-4"><div className="text-sm text-gray-500">Počet blogů</div><div className="text-3xl font-semibold">{tl ? "…" : posts}</div></div>
        <div className="card p-4"><div className="text-sm text-gray-500">Slevové kupony</div><div className="text-3xl font-semibold">{tl ? "…" : coupons}</div></div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium">Tržby (měsíc)</div>
            {seriesErr && <div className="text-sm text-red-600">{seriesErr}</div>}
          </div>
          <div className="text-2xl font-semibold mb-2">{seriesLoading ? "…" : formatCZK(totRevenue)}</div>
          <BarChart data={revenueSeries} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium">Objednávky (měsíc)</div>
          </div>
          <div className="text-2xl font-semibold mb-2">{seriesLoading ? "…" : totOrders}</div>
          <BarChart data={ordersSeries} />
        </div>
      </section>
    </div>
  );
}
