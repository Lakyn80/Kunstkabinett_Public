// src/modules/client/Checkout.jsx
import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../common/CartContext";
import { useAuth } from "../auth/AuthContext";
import api from "../common/apiClient";
import { useI18n } from "../../i18n/I18nProvider";

const DEFAULT_SCHEME =
  typeof window !== "undefined" && window.location?.protocol
    ? window.location.protocol.replace(":", "")
    : "http";

// ======================
// JEDINÁ ÚPRAVA +++
// ======================
function buildImgSrc(raw) {
  if (!raw) return "";
  let u = String(raw).trim().replace(/\\/g, "/");

  // *** FIX Mixed Content ***
  // API URL se NIKDY nesmí spojovat s FILE_BASE
  if (u.startsWith("/api/")) return u;

  if (/^https?:\/\//i.test(u)) return u;
  if (/^\/\//.test(u))
    return `${DEFAULT_SCHEME}:${u}`;
  if (u.startsWith("/")) return u;

  const looksImage = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(u);
  const path = looksImage
    ? (u.startsWith("uploads/") || u.startsWith("media/") ? `/${u}` : `/uploads/products/${u}`)
    : `/${u}`;
  return path;
}
// ======================
// konec jediné změny
// ======================

function buildAddress({ street, city, zip, country = "CZ" }) {
  const s = (street || "").trim();
  const c = (city || "").trim();
  const z = (zip || "").replace(/\s+/g, " ").trim();
  const co = (country || "").trim();
  const safeCountry = co || "CZ";
  if (!s && !c && !z && (!co || safeCountry === "CZ")) return null;
  const cityZip = [c, z].filter(Boolean).join(" ");
  const joined = [s, cityZip, safeCountry].filter(Boolean).join(", ");
  return joined || null;
}

function pickImage(it) {
  if (!it || typeof it !== "object") return "";
  const keys = ["image","image_url","thumbnail","thumbnail_url","img","photo","photo_url","picture","cover","cover_url","filename","file"];
  for (const k of keys) if (it[k]) return String(it[k]);
  return "";
}

function getSelectedCurrency() {
  try {
    return localStorage.getItem("selected_currency") || "CZK";
  } catch {
    return "CZK";
  }
}

function getCurrencyFormatter(currencyCode = "CZK") {
  return new Intl.NumberFormat(
    currencyCode === "EUR" ? "de-DE" : "cs-CZ",
    {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }
  );
}

function getAuthorLabelFallback(p) {
  return String(
    p?.author?.name ?? p?.artist?.name ?? p?.author_name ?? p?.artist_name ?? p?.author ?? p?.artist ?? p?.creator ?? p?.maker ?? ""
  ).trim();
}
function getAuthorIdsFrom(p) {
  const id = p?.author_id ?? p?.artist_id ?? p?.author?.id ?? p?.artist?.id ?? null;
  const slug = p?.author_slug ?? p?.artist_slug ?? p?.author?.slug ?? p?.artist?.slug ?? null;
  return { id: id == null ? null : String(id), slug: slug ? String(slug) : null };
}
function resolveAuthor(source, artistsById, artistsByName, unknownAuthorText = "Neznámý autor") {
  const { id, slug } = getAuthorIdsFrom(source || {});
  const fallback = getAuthorLabelFallback(source || {});
  if (slug) {
    const name = source?.author?.name || source?.artist?.name || fallback || slug;
    return { name: String(name || "").trim() || unknownAuthorText, href: `/artist/${encodeURIComponent(slug)}` };
  }
  if (id && artistsById.has(id)) {
    const a = artistsById.get(id);
    const name = String(a?.name || fallback || "").trim() || unknownAuthorText;
    const href = a?.slug ? `/artist/${encodeURIComponent(String(a.slug))}` : `/artist/id/${encodeURIComponent(String(a.id))}`;
    return { name, href };
  }
  if (fallback) {
    const key = fallback.toLowerCase();
    if (artistsByName.has(key)) {
      const a = artistsByName.get(key);
      const href = a?.slug ? `/artist/${encodeURIComponent(String(a.slug))}` : `/artist/id/${encodeURIComponent(String(a.id))}`;
      return { name: fallback, href };
    }
    return { name: fallback, href: null };
  }
  return { name: unknownAuthorText, href: null };
}

export default function Checkout() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { items, clear, remove } = useCart();
  const { user } = useAuth();

  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [shippingMethod, setShippingMethod] = useState("delivery");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    zip: "",
  });

  const [checkoutCurrency, setCheckoutCurrency] = useState("CZK");
  const [productsMap, setProductsMap] = useState({});

  useEffect(() => {
    (async () => {
      if (!items || items.length === 0) return;
      const productIds = [...new Set(items.map(it => it.product_id || it.id).filter(Boolean))];
      if (productIds.length === 0) return;
      const newMap = {};
      await Promise.all(productIds.map(async (pid) => {
        try {
          const { data } = await api.get(`/api/v1/products/${pid}`, { params: { lang } });
          if (data) newMap[pid] = data;
        } catch {}
      }));
      setProductsMap(newMap);
    })();
  }, [items, lang]);

  useEffect(() => {
    if (Object.keys(productsMap).length === 0 || !items || items.length === 0) return;
    const userSelectedCurrency = getSelectedCurrency();
    const allHaveEur = items.every(it => {
      const pid = it.product_id || it.id;
      const product = productsMap[pid];
      return product && product.price_eur != null && product.price_eur > 0;
    });
    if (allHaveEur && userSelectedCurrency === "EUR") {
      setCheckoutCurrency("EUR");
    } else {
      setCheckoutCurrency("CZK");
    }
  }, [productsMap, items]);

  const handleCurrencyChange = async (newCurrency) => {
    setCheckoutCurrency(newCurrency);
  };

  const checkoutCurrencyFormatter = getCurrencyFormatter(checkoutCurrency);

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [validating, setValidating] = useState(false);

  const [artistsById, setArtistsById] = useState(new Map());
  const [artistsByName, setArtistsByName] = useState(new Map());

  const setCustomerField = (key) => (e) => {
    const value = e?.target?.value ?? "";
    setCustomerInfo((prev) => ({ ...prev, [key]: value }));
    if (profileError) setProfileError("");
  };

  useState(() => {
    let dead = false;
    async function tryGet(url) {
      try { const { data } = await api.get(url); const arr = Array.isArray(data) ? data : data?.items || []; return Array.isArray(arr) ? arr : []; }
      catch { return []; }
    }
    (async () => {
      const publicCandidates = ["/api/v1/artists/?limit=500&offset=0"];
      let list = [];
      for (const p of publicCandidates) { list = await tryGet(p); if (list.length) break; }
      if (dead) return;
      const byId = new Map(), byName = new Map();
      for (const a of list) { if (a?.id != null) byId.set(String(a.id), a); const n = String(a?.name || "").trim(); if (n) byName.set(n.toLowerCase(), a); }
      setArtistsById(byId); setArtistsByName(byName);
    })();
    return () => { dead = true; };
  }, []);

  const rows = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list
      .filter(Boolean)
      .map((it, idx) => {
        const id =
          it?.id ?? it?.product_id ?? it?.pk ?? it?.uuid ?? `cart-${idx}-${(it?.title || it?.name || "x").toString().slice(0, 8)}`;
        const title = (it?.title ?? it?.name ?? "Untitled").toString();
        const qty = Number(it?.qty || 0) || 0;
        const product_id = it?.product_id ?? it?.id ?? id;
        let price = Number(it?.price || 0);
        let displayCurrency = checkoutCurrency;
        const product = productsMap[product_id];
        if (product) {
          if (checkoutCurrency === "EUR" && product.price_eur != null && product.price_eur > 0) {
            price = Number(product.price_eur);
            displayCurrency = "EUR";
          } else {
            price = Number(product.price || it?.price || 0);
            displayCurrency = "CZK";
          }
        } else {
          displayCurrency = "CZK";
        }
        const rawImg = pickImage(it);
        const src = buildImgSrc(rawImg);
        const author = resolveAuthor(it, artistsById, artistsByName, t('cart.unknownAuthor'));
        return { id: String(id), title, qty, price, src, product_id, author, displayCurrency };
      })
      .filter((r) => r.qty > 0 && r.price >= 0);
  }, [items, artistsById, artistsByName, checkoutCurrency, productsMap, t]);

  const { totalCount, totalSum, totalCurrency } = useMemo(() => {
    if (checkoutCurrency === "EUR") {
      const eurRows = rows.filter(r => r.displayCurrency === "EUR");
      const count = eurRows.reduce((s, r) => s + r.qty, 0);
      const sum = eurRows.reduce((s, r) => s + r.qty * r.price, 0);
      return { totalCount: count, totalSum: sum, totalCurrency: "EUR" };
    } else {
      const count = rows.reduce((s, r) => s + r.qty, 0);
      const sum = rows.reduce((s, r) => s + r.qty * r.price, 0);
      return { totalCount: count, totalSum: sum, totalCurrency: "CZK" };
    }
  }, [rows, checkoutCurrency]);

  const currencyMixError = useMemo(() => {
    if (rows.length === 0) return null;
    const productsWithEur = [];
    const productsWithoutEur = [];
    rows.forEach(row => {
      const product = productsMap[row.product_id];
      if (product) {
        if (product.price_eur != null && product.price_eur > 0) {
          productsWithEur.push(row);
        } else {
          productsWithoutEur.push(row);
        }
      } else {
        productsWithoutEur.push(row);
      }
    });
    if (checkoutCurrency === "EUR" && productsWithoutEur.length > 0) {
      return {
        type: "missing_eur",
        message: `Nelze vytvořit objednávku v EUR: některé produkty nemají cenu v EUR. Prosím odstraňte produkty bez EUR ceny nebo změňte měnu na CZK.`,
        productsWithoutEur: productsWithoutEur.map(r => r.title),
      };
    }
    return null;
  }, [rows, productsMap, checkoutCurrency]);

  const discount = useMemo(() => (coupon?.valid ? Number(coupon.discount) : 0), [coupon]);
  const totalAfter = useMemo(() => Math.max(0, Number(totalSum) - Number(discount)), [totalSum, discount]);

  const canPlaceOrder = rows.length > 0 && !!user && !currencyMixError;

  async function handleValidateCoupon() {
    if (!couponCode) return;
    setCouponMsg(""); setValidating(true);
    try {
      const { data } = await api.post("/api/v1/coupons/validate", {
        code: couponCode,
        order_total: Number(Number(totalSum).toFixed(2)),
        currency: checkoutCurrency,
      });
      setCoupon(data);
      if (data.valid) {
        const amount = Number(data.discount).toFixed(2);
        const pctVal = Number(data.percent ?? data.percentage);
        const isPercent = String(data.type).toLowerCase() === "percent";
        const suffix = isPercent && Number.isFinite(pctVal) ? ` (${pctVal}%)` : "";
        setCouponMsg(`${t('checkout.discount')} OK: −${amount}${suffix}`);
      } else {
        setCouponMsg(data.message || t('checkout.couponInvalid'));
      }
    } catch (e) {
      setCoupon(null);
      setCouponMsg(e?.response?.data?.detail || t('checkout.couponVerifyError'));
    } finally { setValidating(false); }
  }
  function clearCoupon() { setCoupon(null); setCouponCode(""); setCouponMsg(""); }

  async function tryCreate(variants) {
    for (const { url, body } of variants) {
      try {
        const { data } = await api.post(url, body);
        return { ok: true, data };
      } catch (e) {
        const s = e?.response?.status;
        if (s === 404) break;
        if (s !== 400 && s !== 422) throw e;
        continue;
      }
    }
    return { ok: false, data: null };
  }

  const fillFromProfile = async () => {
    if (!user || profileLoading) return;
    setProfileError("");
    setProfileLoading(true);
    try {
      const { data } = await api.get("/api/v1/profile/details");
      const shipping = data?.addresses?.shipping || data?.addresses?.billing || {};
      setCustomerInfo({
        name: data?.full_name || "",
        email: data?.email || "",
        phone: data?.phone || "",
        street: shipping?.street || "",
        city: shipping?.city || "",
        zip: shipping?.postal_code || shipping?.zip || "",
      });
    } catch {
      setProfileError(t("common.error"));
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user || profileSaving) return;
    setProfileError("");
    setProfileSaving(true);
    try {
      const payload = {};
      const fullName = String(customerInfo.name || "").trim();
      const email = String(customerInfo.email || "").trim();
      const phone = String(customerInfo.phone || "").trim();
      const billingAddress = buildAddress({
        street: customerInfo.street,
        city: customerInfo.city,
        zip: customerInfo.zip,
        country: "CZ",
      });

      if (fullName) payload.full_name = fullName;
      if (email) payload.email = email;
      if (phone) payload.phone = phone;
      if (billingAddress) payload.billing_address = billingAddress;
      if (billingAddress) payload.same_as_billing = true;

      await api.put("/api/v1/profile", payload);
    } catch {
      setProfileError(t("common.error"));
    } finally {
      setProfileSaving(false);
    }
  };

  const placeOrder = async () => {
    if (!canPlaceOrder || submitting || currencyMixError) return;
    setSubmitting(true);
    setErr("");

    const itemsBasic = rows.map(r => ({ 
      product_id: Number(r.product_id || r.id), 
      qty: Number(r.qty) 
    })).filter(item => 
      Number.isInteger(item.product_id) && 
      item.product_id > 0 && 
      Number.isInteger(item.qty) && 
      item.qty > 0
    );

    if (itemsBasic.length === 0) {
      setErr("Košík neobsahuje žádné platné položky");
      setSubmitting(false);
      return;
    }

   const basePayload = {
      items: itemsBasic,
      use_profile: true,
      payment_method: paymentMethod,
      shipping_method: shippingMethod,
      currency: checkoutCurrency,
      language: lang,
      coupon_code: couponCode || undefined,
    };
    
    const variants = [
      // Prefer trailing slash, aby FastAPI nedělalo 307 redirect (mixer scheme)
      { url: "/api/client/v1/orders/", body: basePayload },
      { url: "/api/client/v1/orders", body: basePayload },
      { url: "/api/client/v1/orders/", body: { ...basePayload, items: itemsBasic.map(i => ({ product_id: i.product_id, quantity: i.qty })) } },
      { url: "/api/client/v1/orders", body: { ...basePayload, items: itemsBasic.map(i => ({ product_id: i.product_id, quantity: i.qty })) } },
      { url: "/orders/", body: basePayload },
      { url: "/orders", body: basePayload },
      { url: "/api/client/v1/orders/", body: { ...basePayload, cart_items: itemsBasic } },
      { url: "/api/client/v1/orders", body: { ...basePayload, cart_items: itemsBasic } },
    ];

    try {
      let res = await tryCreate(variants);
      if (!res.ok) throw new Error("CREATE_FAILED");

      const data = res.data || {};
      const orderId = data?.id ?? data?.order_id;
      const payUrl = data?.payment?.url || data?.payment_url;

      clear?.();

      if (payUrl && paymentMethod === "card") {
        window.location.href = payUrl;
        return;
      }
      if (orderId) nav(`/account/orders/${encodeURIComponent(String(orderId))}`, { replace: true });
      else nav("/account/orders", { replace: true });
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.response?.data?.message || e?.message || t('checkout.unknownError');
      setErr(`${t('checkout.createOrderError')} ${String(detail)}`);
      try {
      } catch {}
    } finally {
      setSubmitting(false);
    }
  };

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-white text-black p-6 shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-800">
        <h1 className="text-xl font-semibold mb-2">{t('checkout.title')}</h1>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t('checkout.empty')}</p>
        <div className="mt-4">
          <Link
            to="/products"
            className="inline-flex items-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            {t('checkout.backToCatalog')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 rounded-xl border bg-white text-black p-6 shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-800">
        <h1 className="text-xl font-semibold mb-4">{t('checkout.title')}</h1>

        {!user && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {t('checkout.loginRequired')}{" "}
            <Link to="/login" className="underline hover:opacity-80">
              {t('checkout.loginLink')}
            </Link>
            .
          </div>
        )}

        {err && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        )}

        {currencyMixError && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <div className="font-semibold mb-2">⚠️ {t('checkout.currencyMixError')}</div>
            <div className="mb-2">{currencyMixError.message}</div>
            {currencyMixError.productsWithoutEur && currencyMixError.productsWithoutEur.length > 0 && (
              <div className="mt-2">
                <div className="font-medium mb-1">{t('checkout.productsWithoutEur')}</div>
                <ul className="list-disc list-inside ml-2">
                  {currencyMixError.productsWithoutEur.map((title, idx) => (
                    <li key={idx}>{title}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 text-xs">
              <strong>{t('checkout.currencyMixSolution').split(':')[0]}:</strong> {t('checkout.currencyMixSolution').split(':').slice(1).join(':').trim()}
            </div>
          </div>
        )}

        <div className="divide-y dark:divide-slate-800">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 py-3">
              <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                {r.src ? (
                  <img
                    src={r.src}
                    alt={r.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm text-slate-500 dark:text-slate-400">
                      {t('products.noImage')}
                    </div>
                  )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.title}</div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {t('checkout.author') || t('cart.author')}: {r.author?.href ? (
                    <Link
                      to={r.author.href}
                      className="underline decoration-slate-400 decoration-1 underline-offset-2 hover:text-slate-900 dark:hover:text-white"
                      title={r.author.name}
                    >
                      {r.author.name}
                    </Link>
                  ) : (
                    <span className="font-normal">{r.author?.name || t('cart.unknownAuthor')}</span>
                  )}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {r.qty} × {getCurrencyFormatter(r.displayCurrency || "CZK").format(r.price)}
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono tabular-nums">
                  {getCurrencyFormatter(r.displayCurrency || "CZK").format(r.qty * r.price)}
                </div>
                <button
                  className="mt-2 text-xs underline hover:opacity-80"
                  onClick={() => remove(r.id)}
                >
                  {t('cart.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            className="text-xs underline hover:opacity-80"
            onClick={() => clear()}
          >
            {t('cart.clearCart')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white text-black p-6 shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-800">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t('orderDetail.customerInfo')}</h2>
            <button
              type="button"
              className="text-xs underline hover:opacity-80 disabled:opacity-50"
              onClick={fillFromProfile}
              disabled={!user || profileLoading}
            >
              {profileLoading ? t("common.loading") : t('orderDetail.fillFromProfile')}
            </button>
          </div>

          <div className="mt-3 grid gap-3 text-sm">
            <div>
              <label className="block text-xs mb-1">{t('orderDetail.name')}</label>
              <input
                className="input text-sm px-3 py-2 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
                value={customerInfo.name}
                onChange={setCustomerField("name")}
              />
            </div>
            <div>
              <label className="block text-xs mb-1">{t('orderDetail.email')}</label>
              <input
                className="input text-sm px-3 py-2 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
                type="email"
                value={customerInfo.email}
                onChange={setCustomerField("email")}
              />
            </div>
            <div>
              <label className="block text-xs mb-1">{t('orderDetail.phone')}</label>
              <input
                className="input text-sm px-3 py-2 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
                value={customerInfo.phone}
                onChange={setCustomerField("phone")}
              />
            </div>
            <div>
              <label className="block text-xs mb-1">{t('orderDetail.street')}</label>
              <input
                className="input text-sm px-3 py-2 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
                value={customerInfo.street}
                onChange={setCustomerField("street")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">{t('orderDetail.city')}</label>
                <input
                  className="input text-sm px-3 py-2 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
                  value={customerInfo.city}
                  onChange={setCustomerField("city")}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">{t('orderDetail.zip')}</label>
                <input
                  className="input text-sm px-3 py-2 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
                  value={customerInfo.zip}
                  onChange={setCustomerField("zip")}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50"
              onClick={saveProfile}
              disabled={!user || profileSaving}
            >
              {profileSaving ? t('orderDetail.saving') : t('orderDetail.save')}
            </button>
            {profileError && (
              <span className="text-xs text-red-600 dark:text-red-300">{profileError}</span>
            )}
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-3">{t('checkout.summary') || 'Souhrn'}</h2>

        <div className="flex items-center justify-between text-sm">
          <span>{t('checkout.items')}</span>
          <span className="font-mono">{totalCount}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-base font-semibold">
          <span>{t('checkout.subtotal')}</span>
          <span>{getCurrencyFormatter(totalCurrency).format(totalSum)}</span>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder={t('checkout.couponCode')}
              className="flex-1 min-w-[180px] rounded-xl border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-white"
            />
            <div className="flex items-stretch gap-2 shrink-0">
              <button
                onClick={handleValidateCoupon}
                disabled={!couponCode || validating}
                className="w-28 shrink-0 rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50 text-center dark:bg-white dark:text-black"
              >
                {validating ? t('checkout.submitting') : t('checkout.apply')}
              </button>
              {couponCode && (
                <button
                  onClick={clearCoupon}
                  className="w-28 shrink-0 rounded-xl border px-4 py-2 text-center"
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 min-h-[1.25rem] text-sm text-slate-800 dark:text-slate-300">
            {couponMsg}
          </div>
        </div>

        <div className="mt-3 min-h-[1.75rem] flex items-center justify-between">
          {discount > 0 ? (
            <>
              <div className="text-emerald-700 dark:text-emerald-400">
                {t('checkout.discount')} ({coupon?.code || couponCode})
              </div>
              <div className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                −{getCurrencyFormatter(totalCurrency).format(discount)}
              </div>
            </>
          ) : (
            <div className="opacity-0 select-none">placeholder</div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3 text-base font-semibold">
          <span>{t('checkout.total')}</span>
          <span>{getCurrencyFormatter(totalCurrency).format(totalAfter)}</span>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <label className="block text-xs mb-1">{t('checkout.paymentCurrency')}</label>
            <select
              className="input h-9 text-sm px-2 pr8 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={checkoutCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
            >
              <option value="CZK">{t('checkout.czk')}</option>
              <option value="EUR">{t('checkout.eur')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">{t('checkout.paymentMethod')}</label>
            <select
              className="input h-9 text-sm px-2 pr8 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="card">{t('checkout.paymentCard')}</option>
              <option value="cod">{t('checkout.paymentCod')}</option>
              <option value="bank">{t('checkout.paymentBank')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">{t('checkout.shipping')}</label>
            <select
              className="input h-9 text-sm px-2 pr8 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
            >
              <option value="delivery">{t('checkout.shippingDelivery')}</option>
              <option value="pickup">{t('checkout.shippingPickup')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">{t('checkout.note')}</label>
            <textarea
              className="input text-sm px-3 py-2 w-full bg-white text-black dark:bg-slate-800 dark:text-white"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('checkout.notePlaceholder')}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            disabled={!canPlaceOrder || submitting || !!currencyMixError}
            onClick={placeOrder}
            title={!user ? t('checkout.loginToComplete') : undefined}
          >
            {submitting ? t('checkout.submitting') : t('orderDetail.payment')}
          </button>

          {!user && (
            <Link
              to="/login"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-center hover:bg-white/70 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t('checkout.loginLink')}
            </Link>
          )}

          <Link
            to="/products"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-center hover:bg-white/70 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t('checkout.backToCatalog')}
          </Link>
        </div>
      </div>
    </div>
  );
}
