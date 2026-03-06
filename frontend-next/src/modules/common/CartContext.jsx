// src/modules/common/CartContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext(null);

// lokální storage klíč pro klientský košík
const LS_KEY = "cart";

// Helper pro získání základní ceny produktu (vždy CZK)
function getProductBasePrice(product) {
  // Vždy vracíme CZK cenu - základní cenu produktu
  return Number(product.price || 0);
}

function loadCart() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveCart(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart());

  useEffect(() => { saveCart(items); }, [items]);

  const totals = useMemo(() => {
    const count = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    const sum   = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    return { count, sum };
  }, [items]);

  // ---- GUARD: pouze přihlášený klient může přidávat do košíku ----
  function ensureLoggedIn() {
    // Client aplikace - kontroluj pouze client token (admin token je izolovaný)
    const isLoggedIn = !!localStorage.getItem("am_client_token");
    if (!isLoggedIn) {
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("after_login_redirect", window.location.pathname + window.location.search);
          window.location.href = "/login";
        }
      } catch {}
      return false;
    }
    return true;
  }

  // helper: vytáhni autora z různých tvarů objektu
  function pickArtistFields(src = {}) {
    const artist_id =
      src.artist_id ?? src.author_id ?? src?.artist?.id ?? src?.author?.id ?? null;
    const artist_slug =
      src.artist_slug ?? src.author_slug ?? src?.artist?.slug ?? src?.author?.slug ?? null;
    const artist_name =
      src.artist_name ?? src.author_name ?? src?.artist?.name ?? src?.author?.name ?? null;
    return {
      artist_id: artist_id == null ? null : String(artist_id),
      artist_slug: artist_slug == null ? null : String(artist_slug),
      artist_name: artist_name == null ? null : String(artist_name),
    };
  }

  // veřejné API košíku
  const value = useMemo(() => ({
    items,
    totals,

    // add: zablokováno pro nepřihlášené (vrací false), jinak true
    add(product, qty = 1) {
      if (!ensureLoggedIn()) return false;

      const id = product?.id ?? product?.product_id ?? product?.pk ?? product?.uuid;
      if (id == null) return false;

      // Zkontroluj dostupný stock
      const availableStock = Number(product.available_stock ?? product.quantity ?? 0);
      if (availableStock <= 0) {
        alert(`Produkt "${product.title ?? product.name ?? 'Untitled'}" není momentálně skladem.`);
        return false;
      }

      const { artist_id, artist_slug, artist_name } = pickArtistFields(product);
      // VŽDY ukládej základní CZK cenu do košíku
      const price = getProductBasePrice(product);

      setItems(prev => {
        const next = [...prev];
        const key = String(id);
        const idx = next.findIndex(it => String(it.id) === key);
        const requestedQty = Number(qty || 1);
        
        if (idx >= 0) {
          const currentQty = Number(next[idx].qty || 0);
          const newQty = currentQty + requestedQty;
          // Omez množství podle dostupného stocku
          const maxQty = Math.min(newQty, availableStock);
          if (maxQty < newQty) {
            alert(`Můžete přidat maximálně ${availableStock} kusů produktu "${product.title ?? product.name ?? 'Untitled'}".`);
          }
          next[idx] = {
            ...next[idx],
            qty: maxQty,
            price: price, // VŽDY CZK cena
            // doplň/aktualizuj autora, pokud nově k dispozici
            artist_id: next[idx].artist_id ?? artist_id,
            artist_slug: next[idx].artist_slug ?? artist_slug,
            artist_name: next[idx].artist_name ?? artist_name,
          };
        } else {
          // Omez množství podle dostupného stocku
          const maxQty = Math.min(requestedQty, availableStock);
          if (maxQty < requestedQty) {
            alert(`Můžete přidat maximálně ${availableStock} kusů produktu "${product.title ?? product.name ?? 'Untitled'}".`);
          }
          next.push({
            id: key,
            title: product.title ?? product.name ?? "Untitled",
            price: price, // VŽDY CZK cena
            qty: maxQty,
            image: product.image_url || product.thumbnail_url || product.thumbnail || product.image || null,
            artist_id,
            artist_slug,
            artist_name,
            // Ulož available_stock pro pozdější kontrolu
            available_stock: availableStock,
          });
        }
        return next;
      });
      return true;
    },

    addMany(list = []) {
      if (!ensureLoggedIn()) return false;
      setItems(prev => {
        const map = new Map(prev.map(it => [String(it.id), { ...it }]));
        for (const p of list) {
          const id = p?.id ?? p?.product_id ?? p?.pk ?? p?.uuid;
          if (id == null) continue;
          const key = String(id);
          const requestedQty = Number(p.qty || 1);
          // VŽDY ukládej základní CZK cenu
          const price = getProductBasePrice(p);
          const { artist_id, artist_slug, artist_name } = pickArtistFields(p);
          
          // Zkontroluj dostupný stock
          const availableStock = Number(p.available_stock ?? p.quantity ?? 0);
          if (availableStock <= 0) continue; // Přeskoč produkty bez stocku

          if (map.has(key)) {
            const it = map.get(key);
            const currentQty = Number(it.qty || 0);
            const newQty = currentQty + requestedQty;
            // Omez množství podle dostupného stocku
            it.qty = Math.min(newQty, availableStock);
            it.price = price; // VŽDY CZK cena
            // doplň autora, pokud chyběl
            it.artist_id = it.artist_id ?? artist_id;
            it.artist_slug = it.artist_slug ?? artist_slug;
            it.artist_name = it.artist_name ?? artist_name;
            map.set(key, it);
          } else {
            // Omez množství podle dostupného stocku
            const maxQty = Math.min(requestedQty, availableStock);
            map.set(key, {
              id: key,
              title: p.title ?? p.name ?? "Untitled",
              price, // VŽDY CZK cena
              qty: maxQty,
              image: p.image_url || p.thumbnail_url || p.thumbnail || p.image || null,
              artist_id,
              artist_slug,
              artist_name,
              available_stock: availableStock,
            });
          }
        }
        return Array.from(map.values());
      });
      return true;
    },

    remove(id) {
      setItems(prev => prev.filter(it => String(it.id) !== String(id)));
    },

    clear() {
      setItems([]);
    },
  }), [items, totals]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
