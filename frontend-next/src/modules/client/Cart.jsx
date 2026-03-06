// src/modules/client/Cart.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../common/CartContext";
import api from "../common/apiClient";
import { useI18n } from "../../i18n/I18nProvider";

const DEFAULT_SCHEME =
  typeof window !== "undefined" && window.location?.protocol
    ? window.location.protocol.replace(":", "")
    : "http";

// IMG helpers
function buildImgSrc(raw) {
  if (!raw) return "";
  let u = String(raw).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(u)) return u;
  if (/^\/\//.test(u)) return `${DEFAULT_SCHEME}:${u}`;
  if (u.startsWith("/")) return u;
  const looksImage = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(u);
  const path = looksImage
    ? (u.startsWith("uploads/") || u.startsWith("media/") ? `/${u}` : `/uploads/products/${u}`)
    : `/${u}`;
  return path;
}
function pickImage(item) {
  if (!item || typeof item !== "object") return "";
  const keys = ["image","image_url","thumbnail","thumbnail_url","img","photo","photo_url","picture","cover","cover_url","filename","file"];
  for (const k of keys) if (item[k]) return String(item[k]);
  return "";
}

// Helper pro získání vybrané měny
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

/* === autor resolve (jako na Home) === */
function getAuthorLabelFallback(p) {
  return String(
    p?.author?.name ?? p?.artist?.name ?? p?.author_name ?? p?.artist_name ??
    p?.author ?? p?.artist ?? p?.creator ?? p?.maker ?? ""
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
    const href = a?.slug
      ? `/artist/${encodeURIComponent(String(a.slug))}`
      : `/artist/id/${encodeURIComponent(String(a.id))}`;
    return { name, href };
  }
  if (fallback) {
    const key = fallback.toLowerCase();
    if (artistsByName.has(key)) {
      const a = artistsByName.get(key);
      const href = a?.slug
        ? `/artist/${encodeURIComponent(String(a.slug))}`
        : `/artist/id/${encodeURIComponent(String(a.id))}`;
      return { name: fallback, href };
    }
    return { name: fallback, href: null };
  }
  return { name: unknownAuthorText, href: null };
}

export default function Cart() {
  const { t } = useI18n();
  const { items, totals, remove, clear } = useCart();
  const list = Array.isArray(items) ? items : [];
  const selectedCurrency = getSelectedCurrency();

  const totalCount = totals?.count || 0;

  // načti seznam autorů
  const [artistsById, setArtistsById] = useState(new Map());
  const [artistsByName, setArtistsByName] = useState(new Map());
  useEffect(() => {
    let dead = false;
    async function tryGet(url) {
      try { const { data } = await api.get(url); const arr = Array.isArray(data) ? data : data?.items || []; return Array.isArray(arr) ? arr : []; }
      catch { return []; }
    }
    (async () => {
      const publicCandidates = ["/api/v1/artists/?limit=500&offset=0"];
      let list = [];
      for (const p of publicCandidates) { list = await tryGet(p); if (list.length) break; }
      // Client aplikace - admin token není dostupný, nepoužívej admin endpointy
      if (false) { // Admin fallback zakázán - client a admin jsou izolované
        for (const p of ["/api/admin/v1/artists/","/admin/artists/"]) { list = await tryGet(p); if (list.length) break; }
      }
      if (dead) return;
      const byId = new Map(), byName = new Map();
      for (const a of list) { if (a?.id != null) byId.set(String(a.id), a); const n = String(a?.name || "").trim(); if (n) byName.set(n.toLowerCase(), a); }
      setArtistsById(byId); setArtistsByName(byName);
    })();
    return () => { dead = true; };
  }, []);

  // protože v košíku nemáme autora uloženého, dotáhneme rychlý produkt meta (id -> artist_id/name/slug/price_eur)
  const [meta, setMeta] = useState(new Map()); // key=id, val=product detail (aspoň artist fields + price_eur)
  useEffect(() => {
    const ids = Array.from(new Set(list.map(it => String(it?.id ?? it?.product_id ?? ""))).values()).filter(Boolean);
    const missing = ids.filter(id => !meta.has(id));
    if (!missing.length) return;
    let dead = false;
    (async () => {
      for (const id of missing) {
        try { 
          // Použij správný endpoint pro získání produktu s price_eur
          const { data } = await api.get(`/api/v1/products/${id}`); 
          if (!dead) setMeta(m => new Map(m).set(String(id), data || {})); 
        }
        catch { if (!dead) setMeta(m => new Map(m).set(String(id), {})); }
      }
    })();
    return () => { dead = true; };
  }, [list, meta]);

  const rows = useMemo(
    () =>
      list.map((it) => {
        const id = String(it?.id ?? it?.product_id ?? it?.pk ?? it?.uuid ?? Math.random().toString(36).slice(2));
        const title = it?.title ?? it?.name ?? "Untitled";
        const qty = Number(it?.qty || 0);
        const rawImg = pickImage(it);
        const src = buildImgSrc(rawImg);
        const pmeta = meta.get(id) || {};
        const author = resolveAuthor({ ...it, ...pmeta }, artistsById, artistsByName, t('cart.unknownAuthor'));
        
        // Získej správnou cenu podle vybrané měny a produktu
        // Košík má vždy CZK ceny, ale pro zobrazení použijeme EUR pokud je vybraná EUR a produkt má price_eur
        let price = Number(it?.price || 0); // Základní CZK cena z košíku
        let displayCurrency = selectedCurrency;
        
        // Pokud je vybraná EUR měna a produkt má price_eur, použij EUR cenu
        if (selectedCurrency === "EUR") {
          const eurPrice = pmeta?.price_eur;
          if (eurPrice != null && eurPrice !== undefined && Number(eurPrice) > 0) {
            // Použij EUR cenu pouze pokud je k dispozici a je větší než 0
            price = Number(eurPrice);
            displayCurrency = "EUR";
          } else {
            // Produkt nemá EUR cenu, použij CZK
            price = Number(it?.price || 0);
            displayCurrency = "CZK";
          }
        } else {
          // Vždy použij CZK cenu (základní cenu z košíku)
          price = Number(it?.price || 0);
          displayCurrency = "CZK";
        }
        
        return { id, title, qty, price, src, author, displayCurrency };
      }),
    [list, meta, artistsById, artistsByName, t, selectedCurrency]
  );
  
  // Vypočítej celkovou sumu podle skutečných měn produktů
  const totalSum = useMemo(() => {
    if (selectedCurrency === "EUR") {
      // Při EUR započítávej pouze produkty s EUR cenou
      const eurRows = rows.filter(r => r.displayCurrency === "EUR");
      return eurRows.reduce((s, r) => s + r.qty * r.price, 0);
    }
    // Při CZK započítávej všechny produkty
    return rows.reduce((s, r) => s + r.qty * r.price, 0);
  }, [rows, selectedCurrency]);
  
  const totalCurrency = useMemo(() => {
    if (selectedCurrency === "EUR") {
      const hasEurProducts = rows.some(r => r.displayCurrency === "EUR");
      return hasEurProducts ? "EUR" : "CZK";
    }
    return "CZK";
  }, [rows, selectedCurrency]);

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <h1 className="text-xl font-semibold mb-2">{t('cart.title')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('cart.empty')}</p>
        <div className="mt-4">
          <Link
            to="/products"
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-slate-900"
          >
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('cart.title')}</h1>
        <button className="text-sm underline hover:opacity-80" onClick={() => clear()} title={t('cart.clearCart')}>
          {t('cart.clearCart')}
        </button>
      </div>

      <div className="divide-y dark:divide-slate-800">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-4 py-4">
            {/* ZVĚTŠENÝ OBRAZOVÝ NÁHLED - z 24px na 48px */}
            <div className="h-48 w-48 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
              {row.src ? (
                <img 
                  src={row.src} 
                  alt={row.title} 
                  className="h-full w-full object-cover transition-transform hover:scale-105" 
                  loading="lazy" 
                  decoding="async" 
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm text-slate-500 dark:text-slate-400">
                  bez obrázku
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-900 dark:text-slate-100">{row.title}</div>

              {/* Autor (link pokud ho známe) */}
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {t('cart.author')} {row.author?.href ? (
                  <Link
                    to={row.author.href}
                    className="underline decoration-slate-400 decoration-1 underline-offset-2 hover:text-slate-900 dark:hover:text-white"
                    title={row.author.name}
                  >
                    {row.author.name}
                  </Link>
                ) : (
                  <span className="font-normal">{row.author?.name || t('cart.unknownAuthor')}</span>
                )}
              </div>

              <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {row.qty} × {getCurrencyFormatter(row.displayCurrency).format(row.price)}
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {getCurrencyFormatter(row.displayCurrency).format(row.qty * row.price)}
              </div>
              <button className="mt-2 text-xs underline hover:opacity-80" onClick={() => remove(row.id)} title={t('cart.remove')}>
                {t('cart.remove')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4 dark:border-slate-800">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {t('cart.items')} <span className="font-mono">{totalCount}</span>
        </div>
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t('cart.total')} {getCurrencyFormatter(totalCurrency).format(totalSum)}
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          to="/checkout"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-slate-900"
        >
          {t('cart.proceedToCheckout')}
        </Link>
        <Link
          to="/products"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white/70 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('cart.continueShopping')}
        </Link>
      </div>
    </div>
  );
}
