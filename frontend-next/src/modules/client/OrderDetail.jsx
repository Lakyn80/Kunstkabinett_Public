// src/modules/client/OrderDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../common/apiClient.js";
import { useI18n } from "../../i18n/I18nProvider";
import { formatArtistDisplayName } from "../common/artistName";

const DEFAULT_SCHEME =
  typeof window !== "undefined" && window.location?.protocol
    ? window.location.protocol.replace(":", "")
    : "http";

function absoluteUrlMaybe(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("//")) return `${DEFAULT_SCHEME}:${path}`;
  const base =
    (api?.defaults && api.defaults.baseURL) ||
    (typeof window !== "undefined" ? window.location?.origin : "") ||
    "";
  if (!base) return path;
  const normalizedBase = String(base).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildImgSrc(u) {
  if (!u) return "";
  u = String(u).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `${DEFAULT_SCHEME}:${u}`;
  if (u.startsWith("/")) return absoluteUrlMaybe(u);
  const looksImage = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(u);
  const path = looksImage
    ? (u.startsWith("uploads/") || u.startsWith("media/") ? `/${u}` : `/uploads/products/${u}`)
    : `/${u}`;
  return absoluteUrlMaybe(path);
}
function fmtCurrency(n, currency = 'CZK') {
  const x = Number(n || 0);
  const locale = currency === 'EUR' ? 'de-DE' : 'cs-CZ';
  try { 
    return new Intl.NumberFormat(locale, {style:"currency", currency, maximumFractionDigits:0}).format(x); 
  } catch { 
    return `${x.toFixed(0)} ${currency}`; 
  }
}
function buildAddress({ street, city, zip, country = 'CZ' }) {
  const s = (street || '').trim();
  const c = (city || '').trim();
  const z = (zip || '').replace(/\s+/g, ' ').trim();
  const co = (country || '').trim();
  const safeCountry = co || 'CZ';
  if (!s && !c && !z && (!co || safeCountry === 'CZ')) return null;
  const cityZip = [c, z].filter(Boolean).join(' ');
  const joined = [s, cityZip, safeCountry].filter(Boolean).join(', ');
  return joined || null;
}
function getAuthorLabel(src) {
  const fromProduct =
    src?.author?.name ?? src?.artist?.name ?? src?.author_name ?? src?.artist_name ??
    src?.author ?? src?.artist ?? src?.creator ?? src?.maker ?? "";
  const fromItem =
    src?.product_author ?? src?.product_artist ?? src?.item_author ?? src?.item_artist ?? "";
  return String(fromProduct || fromItem || "").trim();
}
function pickImageFromAny(obj){
  if(!obj || typeof obj!=="object") return "";
  const KEYS = [
    "product_image","image","image_url","img","img_url",
    "thumbnail","thumbnail_url","photo","photo_url",
    "picture","cover","cover_url","filename","file","url","path"
  ];
  for(const k of KEYS){ if(obj[k]) return String(obj[k]); }
  if(obj.product){
    const v = pickImageFromAny(obj.product); if(v) return v;
  }
  if(Array.isArray(obj.images) && obj.images.length){
    const v = pickImageFromAny(obj.images[0]); if(v) return v;
  }
  if(obj.media){
    const v = pickImageFromAny(obj.media); if(v) return v;
  }
  return "";
}

function getAuthorLabelFallback(src) {
  return String(
    src?.author?.name ?? src?.artist?.name ?? src?.author_name ?? src?.artist_name ??
    src?.author ?? src?.artist ?? src?.creator ?? src?.maker ?? ""
  ).trim();
}
function getAuthorIds(src) {
  const id = src?.artist_id ?? src?.author_id ?? src?.artist?.id ?? src?.author?.id ?? null;
  const slug = src?.artist_slug ?? src?.author_slug ?? src?.artist?.slug ?? src?.author?.slug ?? null;
  return { id: id == null ? null : String(id), slug: slug ? String(slug) : null };
}
function resolveAuthor(src, artistsById, artistsByName, unknownAuthorText = "Neznámý autor") {
  const { id, slug } = getAuthorIds(src || {});
  const fallback = getAuthorLabelFallback(src || {});
  if (slug) {
    const name = src?.artist?.name || src?.author?.name || fallback || slug;
    return { name: String(name || "").trim() || unknownAuthorText, href: `/artist/${encodeURIComponent(slug)}` };
  }
  if (id && artistsById?.has?.(id)) {
    const a = artistsById.get(id);
    const name = String(a?.name || fallback || "").trim() || unknownAuthorText;
    const href = a?.slug ? `/artist/${encodeURIComponent(String(a.slug))}` : `/artist/id/${encodeURIComponent(String(a.id))}`;
    return { name, href };
  }
  if (fallback) {
    const key = fallback.toLowerCase();
    if (artistsByName?.has?.(key)) {
      const a = artistsByName.get(key);
      const href = a?.slug ? `/artist/${encodeURIComponent(String(a.slug))}` : `/artist/id/${encodeURIComponent(String(a.id))}`;
      return { name: fallback, href };
    }
    return { name: fallback, href: null };
  }
  return { name: unknownAuthorText, href: null };
}

export default function ClientOrderDetail() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState(null);

  const [prodInfoMap, setProdInfoMap] = useState({});
  const [artistsById, setArtistsById] = useState(new Map());
  const [artistsByName, setArtistsByName] = useState(new Map());

  const [payChoice, setPayChoice] = useState(null);
  const [paying, setPaying] = useState(false);

  const [bank, setBank] = useState(null);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    zip: "",
    country: "CZ",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [maskedProfile, setMaskedProfile] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const { data } = await api.get(`/api/client/v1/orders/${id}`);
        setOrder(data);
      } catch {
        setErr("Objednávku se nepodařilo načíst.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    let dead = false;
    async function tryGet(url) {
      try {
        const { data } = await api.get(url);
        const arr = Array.isArray(data) ? data : (data?.items || []);
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    }
    (async () => {
      const publicCandidates = ["/api/v1/artists/?limit=500&offset=0"];
      let list = [];
      for (const path of publicCandidates) { list = await tryGet(path); if (list.length) break; }
      // Client aplikace - admin token není dostupný, nepoužívej admin endpointy
      if (false) { // Admin fallback zakázán - client a admin jsou izolované
        for (const path of ["/api/admin/v1/artists/","/admin/artists/"]) { list = await tryGet(path); if (list.length) break; }
      }
      if (dead) return;
      const byId = new Map(), byName = new Map();
      for (const a of list) {
        if (a?.id != null) byId.set(String(a.id), a);
        const n = String(a?.name || "").trim();
        if (n) byName.set(n.toLowerCase(), a);
      }
      setArtistsById(byId); setArtistsByName(byName);
    })();
    return () => { dead = true; };
  }, []);

  // ✅ bank info: načti bankovní údaje pro QR kód
  async function loadBank() {
    try {
      const { data } = await api.get(`/api/client/v1/orders/${id}/bank`);
      setBank(data || null);
    } catch (e) {
      setBank(null);
    }
  }
  useEffect(() => { if (order) loadBank(); }, [order]);

  const onCustomerChange = (field) => (e) => {
    const value = e?.target?.value ?? "";
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
  };

  const fillFromProfile = async () => {
    setProfileError("");
    if (profileLoading) return;
    setProfileLoading(true);
    try {
      const { data } = await api.get("/api/v1/profile");
      setMaskedProfile(data?.masked || null);
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || t("common.error");
      setProfileError(String(detail));
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    setProfileError("");
    if (profileSaving) return;
    setProfileSaving(true);
    try {
      const address = buildAddress({
        street: customerInfo.street,
        city: customerInfo.city,
        zip: customerInfo.zip,
        country: customerInfo.country || "CZ",
      });
      const payload = {
        full_name: (customerInfo.name || "").trim() || undefined,
        email: (customerInfo.email || "").trim() || undefined,
        phone: (customerInfo.phone || "").trim() || undefined,
        address: address || undefined,
        same_as_billing: true,
      };
      await api.put("/api/v1/profile", payload);
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || t("common.error");
      setProfileError(String(detail));
    } finally {
      setProfileSaving(false);
    }
  };

  // ✅ pokud /orders/:id/pay-intent/bank-transfer neexistuje, jen přepni na pending_payment a pokračuj na rekapitulaci
  const markPendingPayment = async () => {
    setPaying(true);
    try {
      try {
        const { data } = await api.post(`/api/client/v1/orders/${id}/pay-intent/bank-transfer`);
        setOrder(o => o ? { ...o, status: data?.status || "pending_payment", payment_method: data?.payment_method || "bank_transfer", vs_code: data?.vs_code || o.vs_code } : o);
      } catch (e1) {
        const s = e1?.response?.status;
        if (s !== 404) throw e1;
        setOrder(o => o ? { ...o, status: "pending_payment", payment_method: "bank_transfer" } : o);
      }
      navigate(`/account/orders/${id}/payment`, { replace: true });
    } finally { setPaying(false); }
  };

  const total = useMemo(() => {
    if (!order) return 0;
    if (order.total != null) return Number(order.total) || 0;
    const items = Array.isArray(order.items) ? order.items : [];
    return items.reduce((s, i) => s + Number(i.unit_price || i.price || 0) * Number(i.qty || i.quantity || 1), 0);
  }, [order]);

  const items = Array.isArray(order?.items) ? order.items : [];
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [id]);

  useEffect(() => {
    (async () => {
      const missing = [];
      for (const it of items) {
        const pid = it.product_id || it.id;
        const hasImg = !!pickImageFromAny(it);
        const hasTitle = !!(it.product_title || it.title || it.name);
        if ((!hasImg || !hasTitle) && pid && !prodInfoMap[pid]) missing.push(pid);
      }
      if (!missing.length) return;
      const unique = [...new Set(missing)];
      const newMap = {};
      await Promise.all(unique.map(async (pid) => {
        try { const { data } = await api.get(`/api/v1/products/${pid}`, { params: { lang } }); newMap[pid] = data || null; }
        catch { newMap[pid] = null; }
      }));
      setProdInfoMap(m => ({ ...m, ...newMap }));
    })();
  }, [items, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const slides = useMemo(() => {
    if (!t) return [];
    const unknownAuthor = t('orderDetail.unknownAuthor') || t('artists.unknownAuthor') || 'Neznámý autor';
    return items.map((it) => {
      const pid = it.product_id || it.id;
      const p = prodInfoMap[pid] || {};
      const title = it.product_title || it.title || it.name || p.title || p.name || (pid ? `#${pid}` : "—");
      let authorName = getAuthorLabel(it) || getAuthorLabel(p) || "";
      const authorResolved = resolveAuthor(p, artistsById, artistsByName, unknownAuthor);
      if (!authorName) authorName = authorResolved.name || "";
      const authorHref = authorResolved.href || null;
      const displayAuthor = formatArtistDisplayName(authorName || unknownAuthor, { unknowns: [unknownAuthor] });
      const rawImg = pickImageFromAny(it) || pickImageFromAny(p) || "";
      const img = buildImgSrc(rawImg);
      return { pid, title, authorName: displayAuthor || unknownAuthor, authorHref, img, qty: Number(it.qty || it.quantity || 1), unit: Number(it.unit_price || it.price || 0) };
    });
  }, [items, prodInfoMap, artistsById, artistsByName, t]);

  const current = slides[idx] || null;
  const maskedAddress = maskedProfile?.addresses?.shipping || maskedProfile?.addresses?.billing || null;

  const onPayCard = async () => { setPaying(true); try { /* gateway */ } finally { setPaying(false); } };

  if (loading) return <div className="p-6">{t('orderDetail.loading')}</div>;
  if (err) return (
    <div className="card p-6 space-y-3">
      <div className="text-red-600">{err}</div>
      <Link to="/account/orders" className="btn">{t('orderDetail.backToList') || t('common.back')}</Link>
    </div>
  );
  if (!order) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/account/orders" className="underline hover:opacity-80">{t('orderDetail.back')}</Link>
        <div className="text-sm text-slate-600 dark:text-slate-300">{t('orderDetail.status')} <b className="text-slate-900 dark:text-white">
          {(() => {
            const status = order.status;
            if (status === 'pending_payment') return t('status.pendingPayment');
            if (status === 'paid') return t('status.paid');
            if (status === 'draft') return t('status.draft');
            if (status === 'shipped') return t('status.shipped');
            if (status === 'canceled') return t('status.canceled');
            if (status === 'expired') return t('status.expired');
            if (status === 'sold') return t('status.sold');
            if (status === 'reserved') return t('status.reserved');
            return status || "—";
          })()}
        </b></div>
      </div>

      <section className="overflow-hidden rounded-3xl border card--halo card--glass card--tint bg-card">
        {current?.img ? (
          <div className="px-6 pt-6 pb-2">
            <div className="mx-auto max-w-3xl">
              <div className="art-frame art-aspect">
                <div className="art-media">
                  <img src={current.img} alt={current.title || t('orderDetail.orderNumber', {id: order.id})} loading="eager" decoding="async" className="h-full w-full object-contain object-center" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {slides.length > 1 && (
          <div className="px-6">
            <div className="mx-auto max-w-3xl flex items-center justify-between gap-3 pb-4">
              <button className="btn" onClick={() => setIdx((i) => (i-1+slides.length)%slides.length)}>← {t('common.previous')}</button>
              <div className="flex items-center gap-1">
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)} className={`h-2 w-2 rounded-full ${i===idx ? "bg-slate-900 dark:bg-white" : "bg-slate-300 dark:bg-slate-600"}`} aria-label={`${t('orderDetail.item') || 'Položka'} ${i+1}`} />
                ))}
              </div>
              <button className="btn" onClick={() => setIdx((i) => (i+1)%slides.length)}>{t('common.next')} →</button>
            </div>
          </div>
        )}

        <div className="px-6 pb-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white truncate">
                  {(current?.title && slides.length>1) ? `${current.title} — ${t('orderDetail.item') || 'položka'} ${idx+1}/${slides.length}` : (current?.title || t('orderDetail.orderNumber', {id: order.id}))}
                </h1>
                {current?.authorName && (
                  <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {t('orderDetail.author')}: {current.authorHref ? (
                      <Link to={current.authorHref} className="underline decoration-slate-400 decoration-1 underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200" title={current.authorName}>
                        {current.authorName}
                      </Link>
                    ) : (<span className="font-medium">{current.authorName}</span>)}
                  </div>
                )}
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('orderDetail.orderNumber', {id: order.id})}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('orderDetail.total')}</div>
                <div className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                  {fmtCurrency(total, order.currency || 'CZK')}
                </div>
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {current ? <>{t('orderDetail.quantity')} <b className="text-slate-900 dark:text-white">{current.qty}</b> &nbsp;•&nbsp; {t('orderDetail.unitPrice')} <b className="text-slate-900 dark:text-white">{fmtCurrency(current.unit, order.currency || 'CZK')}</b></> : null}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-slate-500 dark:text-slate-400">{t('orderDetail.paymentMethod')}</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {(() => {
                    const method = order.payment_method;
                    if (method === 'card' || method === 'card_online') return t('checkout.paymentCard');
                    if (method === 'bank' || method === 'bank_transfer' || method === 'bank-transfer') return t('checkout.paymentBank');
                    if (method === 'cod' || method === 'cash_on_delivery') return t('checkout.paymentCod');
                    return method || "—";
                  })()}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">{t('orderDetail.delivery')}</div>
                <div className="mt-1 text-slate-900 dark:text-slate-100">
                  {(() => {
                    const method = order.shipping_method;
                    if (method === 'delivery') return t('checkout.shippingDelivery');
                    if (method === 'pickup') return t('checkout.shippingPickup');
                    return method || "—";
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{t('orderDetail.customerInfo')}</h2>
          <button
            className="text-xs underline hover:opacity-80 disabled:opacity-50"
            onClick={fillFromProfile}
            disabled={profileLoading}
          >
            {t('orderDetail.fillFromProfile')}
          </button>
        </div>

        {profileError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {profileError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <label className="block text-xs mb-1">{t('orderDetail.name')}</label>
            <input
              className="input w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={customerInfo.name}
              onChange={onCustomerChange('name')}
              placeholder={maskedProfile?.full_name || t('orderDetail.name')}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">{t('orderDetail.email')}</label>
            <input
              className="input w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={customerInfo.email}
              onChange={onCustomerChange('email')}
              placeholder={maskedProfile?.email || t('orderDetail.email')}
              type="email"
            />
          </div>
          <div>
            <label className="block text-xs mb-1">{t('orderDetail.phone')}</label>
            <input
              className="input w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={customerInfo.phone}
              onChange={onCustomerChange('phone')}
              placeholder={maskedProfile?.phone || t('orderDetail.phone')}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('account.phoneNote')}
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1">{t('orderDetail.street')}</label>
            <input
              className="input w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={customerInfo.street}
              onChange={onCustomerChange('street')}
              placeholder={maskedAddress?.street || t('orderDetail.street')}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">{t('orderDetail.city')}</label>
            <input
              className="input w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={customerInfo.city}
              onChange={onCustomerChange('city')}
              placeholder={maskedAddress?.city || t('orderDetail.city')}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">{t('orderDetail.zip')}</label>
            <input
              className="input w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={customerInfo.zip}
              onChange={onCustomerChange('zip')}
              placeholder={maskedAddress?.postal_code || t('orderDetail.zip')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn"
            onClick={saveProfile}
            disabled={profileSaving}
          >
            {profileSaving ? t('orderDetail.saving') : t('orderDetail.save')}
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold">{t('orderDetail.payment')}</h2>

        <div className="flex flex-wrap gap-2">
          {["card", "bank", "cod"].map((opt) => (
            <button key={opt} className={`btn ${payChoice === opt ? "btn-primary" : ""}`} onClick={() => setPayChoice(opt)}>
              {opt === "card" ? t('checkout.paymentCard') : opt === "bank" ? t('orderDetail.bankTransfer') : t('checkout.paymentCod')}
            </button>
          ))}
        </div>

        {payChoice === "card" && (
          <div className="pt-2">
            <button className="btn btn-primary" onClick={onPayCard} disabled={paying || order.status === "paid"}>
              {paying ? t('orderDetail.loading') : t('checkout.paymentCard')}
            </button>
            {order.status === "paid" && <div className="mt-2 text-sm text-emerald-700">{t('orderDetail.alreadyPaid')}</div>}
          </div>
        )}

        {payChoice === "bank" && (
          <div className="pt-2 space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {t('orderDetail.bankTransferNote')}
            </div>
            <div>
              <button className="btn btn-primary" onClick={markPendingPayment} disabled={paying || order.status === "paid"}>
                {paying ? t('orderDetail.loading') : t('orderDetail.bankTransfer')}
              </button>
              {order.status === "pending_payment" && <div className="mt-2 text-sm text-amber-700">{t('orderDetail.pendingPayment')}</div>}
            </div>
          </div>
        )}

        {payChoice === "cod" && (<div className="pt-2 text-sm text-slate-600 dark:text-slate-300">{t('orderDetail.codNote')}</div>)}
      </div>
    </div>
  );
}
