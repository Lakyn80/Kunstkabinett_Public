import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { backendUrl } from "../../shared/adminApiClient";

function getMediaPreviewUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return backendUrl(raw.startsWith("/") ? raw : `/${raw}`);
}

export default function Media() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    products: [],
    categories: [],
    artists: [],
    kinds: [],
    mime_prefixes: [],
  });

  const [q, setQ] = useState("");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [artistId, setArtistId] = useState("");
  const [kind, setKind] = useState("");
  const [mimePrefix, setMimePrefix] = useState("");
  const [hasFile, setHasFile] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const visibleItems = useMemo(() => {
    const byProduct = new Map();
    for (const item of items) {
      const productId = Number(item?.product_id || 0);
      if (!productId) continue;
      const key = `p:${productId}`;
      const prev = byProduct.get(key);
      if (!prev) {
        byProduct.set(key, item);
        continue;
      }
      const prevIsImage = String(prev?.mime || "").startsWith("image/");
      const currIsImage = String(item?.mime || "").startsWith("image/");
      if (!prevIsImage && currIsImage) byProduct.set(key, item);
    }
    return Array.from(byProduct.values());
  }, [items]);

  const loadFilters = async () => {
    try {
      const { data } = await api.get("/api/media/filters");
      setFilters({
        products: Array.isArray(data?.products) ? data.products : [],
        categories: Array.isArray(data?.categories) ? data.categories : [],
        artists: Array.isArray(data?.artists) ? data.artists : [],
        kinds: Array.isArray(data?.kinds) ? data.kinds : [],
        mime_prefixes: Array.isArray(data?.mime_prefixes) ? data.mime_prefixes : [],
      });
    } catch {
      setFilters({
        products: [],
        categories: [],
        artists: [],
        kinds: [],
        mime_prefixes: [],
      });
    }
  };

  const loadMedia = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        limit,
        offset,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (q.trim()) params.q = q.trim();
      if (productId) params.product_id = Number(productId);
      if (categoryId) params.category_id = Number(categoryId);
      if (artistId) params.artist_id = Number(artistId);
      if (kind) params.kind = kind;
      if (mimePrefix) params.mime_prefix = mimePrefix;
      if (hasFile === "true") params.has_file = true;
      if (hasFile === "false") params.has_file = false;
      if (createdFrom) params.created_from = createdFrom;
      if (createdTo) params.created_to = createdTo;

      const { data } = await api.get("/api/media", { params });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
    } catch (e) {
      setError(e?.response?.data?.detail || "Nepodařilo se načíst media.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, limit, sortBy, sortDir]);

  const applyFilters = async (e) => {
    e?.preventDefault?.();
    setOffset(0);
    await loadMedia();
  };

  const resetFilters = () => {
    setQ("");
    setProductId("");
    setCategoryId("");
    setArtistId("");
    setKind("");
    setMimePrefix("");
    setHasFile("");
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setLimit(20);
    setOffset(0);
  };

  const prevPage = () => {
    if (offset > 0) setOffset((v) => Math.max(0, v - limit));
  };

  const nextPage = () => {
    if (page < pages) setOffset((v) => v + limit);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Media</h2>
        <div className="text-sm text-gray-500">Celkem: {total}</div>
      </div>

      <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="block text-xs mb-1">Hledat</label>
          <input className="input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="soubor, produkt, autor…" />
        </div>
        <div>
          <label className="block text-xs mb-1">Produkt</label>
          <select className="input w-full" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">— vše —</option>
            {filters.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} #{p.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Kategorie</label>
          <select className="input w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— vše —</option>
            {filters.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Autor</label>
          <select className="input w-full" value={artistId} onChange={(e) => setArtistId(e.target.value)}>
            <option value="">— vše —</option>
            {filters.artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Kind</label>
          <select className="input w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">— vše —</option>
            {filters.kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">MIME prefix</label>
          <select className="input w-full" value={mimePrefix} onChange={(e) => setMimePrefix(e.target.value)}>
            <option value="">— vše —</option>
            {filters.mime_prefixes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Soubor existuje</label>
          <select className="input w-full" value={hasFile} onChange={(e) => setHasFile(e.target.value)}>
            <option value="">— vše —</option>
            <option value="true">Ano</option>
            <option value="false">Ne</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Na stránku</label>
          <select className="input w-full" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)}>
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Od</label>
          <input className="input w-full" type="datetime-local" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1">Do</label>
          <input className="input w-full" type="datetime-local" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1">Řadit podle</label>
          <select className="input w-full" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="created_at">created_at</option>
            <option value="filename">filename</option>
            <option value="product_title">product_title</option>
            <option value="product_id">product_id</option>
            <option value="size">size</option>
            <option value="kind">kind</option>
            <option value="mime">mime</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Směr</label>
          <select className="input w-full" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>
        <div className="md:col-span-4 flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Načítám…" : "Filtrovat"}
          </button>
          <button type="button" className="btn" onClick={resetFilters} disabled={loading}>
            Reset
          </button>
        </div>
      </form>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleItems.map((item) => (
          <Link key={`${item.product_id}-${item.media_id}`} to={`/admin/products/${item.product_id}`} className="block overflow-hidden rounded border bg-white">
            {String(item.mime || "").startsWith("image/") ? (
              <img src={getMediaPreviewUrl(item.url)} alt="" className="h-48 w-full object-cover md:h-56" />
            ) : (
              <div className="h-48 w-full bg-gray-100 md:h-56" />
            )}
          </Link>
        ))}
        {!loading && visibleItems.length === 0 && (
          <div className="col-span-full py-8 text-center text-gray-500">Žádná media.</div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>Strana {page} / {pages}</div>
        <div className="flex gap-2">
          <button className="btn" onClick={prevPage} disabled={loading || offset === 0}>◀ Předchozí</button>
          <button className="btn" onClick={nextPage} disabled={loading || page >= pages}>Další ▶</button>
        </div>
      </div>
    </div>
  );
}
