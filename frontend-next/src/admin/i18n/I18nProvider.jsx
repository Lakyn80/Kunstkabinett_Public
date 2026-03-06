// src/i18n/I18nProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * JednoduchĂ˝ i18n bez dependencĂ­.
 * - SlovnĂ­ky jsou inline, aĹĄ neĹ™eĹˇĂ­me JSON importy ve Vite.
 * - Jazyk se pamatuje v localStorage a nastavĂ­ <html lang="..">.
 * - Funkce t('a.b', {x:1}) â€“ podporuje parametrickĂ© nahrazovĂˇnĂ­.
 */

// ---- SlovnĂ­ky --------------------------------------------------------------
const cs = {
  brand: { name: "Arte Moderno" },
  nav: { home: "DomĹŻ", discover: "Objev umÄ›nĂ­", artists: "UmÄ›lci", blog: "Blog", login: "PĹ™ihlĂˇsit" },
  footer: { terms: "PodmĂ­nky", privacy: "SoukromĂ­", support: "Podpora" },
  home: {
    badge: "KurĂˇtorĹŻv vĂ˝bÄ›r",
    title: "The September Collection",
    subtitle: "Objev modernĂ­ dĂ­la od souÄŤasnĂ˝ch autorĹŻ. OkamĹľitĂˇ platba, bezpeÄŤnĂ© doruÄŤenĂ­.",
    ctaProducts: "ProhlĂ©dnout produkty",
    ctaBlog: "ÄŚĂ­st blog",
    caption: "{badge} Â· 2025"
  }
};

const en = {
  brand: { name: "Arte Moderno" },
  nav: { home: "Home", discover: "Explore", artists: "Artists", blog: "Blog", login: "Sign in" },
  footer: { terms: "Terms", privacy: "Privacy", support: "Support" },
  home: {
    badge: "Curator's Pick",
    title: "The September Collection",
    subtitle: "Discover contemporary works by emerging artists. Instant checkout, secure delivery.",
    ctaProducts: "Browse products",
    ctaBlog: "Read blog",
    caption: "{badge} Â· 2025"
  }
};

const fr = {
  brand: { name: "Arte Moderno" },
  nav: { home: "Accueil", discover: "DĂ©couvrir", artists: "Artistes", blog: "Blog", login: "Se connecter" },
  footer: { terms: "Conditions", privacy: "ConfidentialitĂ©", support: "Support" },
  home: {
    badge: "SĂ©lection du conservateur",
    title: "La Collection de Septembre",
    subtitle: "DĂ©couvrez des Ĺ“uvres contemporaines d'artistes Ă©mergents. Paiement instantanĂ©, livraison sĂ©curisĂ©e.",
    ctaProducts: "Parcourir les produits",
    ctaBlog: "Lire le blog",
    caption: "{badge} Â· 2025"
  }
};

const de = {
  brand: { name: "Arte Moderno" },
  nav: { home: "Start", discover: "Entdecken", artists: "KĂĽnstler", blog: "Blog", login: "Anmelden" },
  footer: { terms: "Nutzungsbedingungen", privacy: "Datenschutz", support: "Support" },
  home: {
    badge: "Kuratorenauswahl",
    title: "Die September-Kollektion",
    subtitle: "Entdecken Sie zeitgenĂ¶ssische Werke aufstrebender KĂĽnstler. Sofortiger Checkout, sichere Lieferung.",
    ctaProducts: "Produkte ansehen",
    ctaBlog: "Blog lesen",
    caption: "{badge} Â· 2025"
  }
};

const ru = {
  brand: { name: "Arte Moderno" },
  nav: { home: "Đ“Đ»Đ°Đ˛Đ˝Đ°ŃŹ", discover: "ĐžĐ±Đ·ĐľŃ€", artists: "ĐĄŃĐ´ĐľĐ¶Đ˝Đ¸ĐşĐ¸", blog: "Đ‘Đ»ĐľĐł", login: "Đ’ĐľĐąŃ‚Đ¸" },
  footer: { terms: "ĐŁŃĐ»ĐľĐ˛Đ¸ŃŹ", privacy: "ĐšĐľĐ˝Ń„Đ¸Đ´ĐµĐ˝Ń†Đ¸Đ°Đ»ŃŚĐ˝ĐľŃŃ‚ŃŚ", support: "ĐźĐľĐ´Đ´ĐµŃ€Đ¶ĐşĐ°" },
  home: {
    badge: "Đ’Ń‹Đ±ĐľŃ€ ĐşŃŃ€Đ°Ń‚ĐľŃ€Đ°",
    title: "ĐˇĐµĐ˝Ń‚ŃŹĐ±Ń€ŃŚŃĐşĐ°ŃŹ ĐşĐľĐ»Đ»ĐµĐşŃ†Đ¸ŃŹ",
    subtitle: "ĐžŃ‚ĐşŃ€ĐľĐąŃ‚Đµ ŃĐľĐ˛Ń€ĐµĐĽĐµĐ˝Đ˝Ń‹Đµ Ń€Đ°Đ±ĐľŃ‚Ń‹ ĐĽĐľĐ»ĐľĐ´Ń‹Ń… Ń…ŃĐ´ĐľĐ¶Đ˝Đ¸ĐşĐľĐ˛. ĐśĐłĐ˝ĐľĐ˛ĐµĐ˝Đ˝Đ°ŃŹ ĐľĐżĐ»Đ°Ń‚Đ°, Đ±ĐµĐ·ĐľĐżĐ°ŃĐ˝Đ°ŃŹ Đ´ĐľŃŃ‚Đ°Đ˛ĐşĐ°.",
    ctaProducts: "ĐˇĐĽĐľŃ‚Ń€ĐµŃ‚ŃŚ Ń‚ĐľĐ˛Đ°Ń€Ń‹",
    ctaBlog: "Đ§Đ¸Ń‚Đ°Ń‚ŃŚ Đ±Đ»ĐľĐł",
    caption: "{badge} Â· 2025"
  }
};

const zh = {
  brand: { name: "Arte Moderno" },
  nav: { home: "é¦–éˇµ", discover: "ĺŹ‘çŽ°", artists: "č‰şćśŻĺ®¶", blog: "ĺŤšĺ®˘", login: "ç™»ĺ˝•" },
  footer: { terms: "ćťˇć¬ľ", privacy: "éšç§", support: "ć”ŻćŚ" },
  home: {
    badge: "ç­–ĺ±•äşşç˛ľé€‰",
    title: "äąťćśç˛ľé€‰",
    subtitle: "ĺŹ‘çŽ°ć–°é”č‰şćśŻĺ®¶çš„ĺ˝“ä»Łä˝śĺ“ă€‚ĺŤłć—¶ç»“č´¦ďĽŚĺ®‰ĺ…¨é…Ťé€ă€‚",
    ctaProducts: "ćµŹč§äş§ĺ“",
    ctaBlog: "é…čŻ»ĺŤšĺ®˘",
    caption: "{badge} Â· 2025"
  }
};

const ja = {
  brand: { name: "Arte Moderno" },
  nav: { home: "ă›ăĽă ", discover: "ćŽ˘ă™", artists: "ă‚˘ăĽă†ă‚Łă‚ąă", blog: "ă–ă­ă‚°", login: "ă­ă‚°ă‚¤ăł" },
  footer: { terms: "ĺ©ç”¨č¦Źç´„", privacy: "ă—ă©ă‚¤ăă‚·ăĽ", support: "ă‚µăťăĽă" },
  home: {
    badge: "ă‚­ăĄă¬ăĽă‚żăĽă‚şă»ă”ăă‚Ż",
    title: "9ćśă‚łă¬ă‚Żă‚·ă§ăł",
    subtitle: "ć–°é€˛ć°—é‹­ă‚˘ăĽă†ă‚Łă‚ąăă®ă‚łăłă†ăłăťă©ăŞăĽä˝śĺ“ă‚’ç™şč¦‹ă€‚ĺŤłć™‚ăă‚§ăă‚Żă‚˘ă‚¦ăă€ĺ®‰ĺ…¨ăŞé…Ťé€ă€‚",
    ctaProducts: "ĺ•†ĺ“ă‚’č¦‹ă‚‹",
    ctaBlog: "ă–ă­ă‚°ă‚’čŞ­ă‚€",
    caption: "{badge} Â· 2025"
  }
};

const it = {
  brand: { name: "Arte Moderno" },
  nav: { home: "Home", discover: "Scopri", artists: "Artisti", blog: "Blog", login: "Accedi" },
  footer: { terms: "Termini", privacy: "Privacy", support: "Supporto" },
  home: {
    badge: "Scelta del curatore",
    title: "La Collezione di Settembre",
    subtitle: "Scopri opere contemporanee di artisti emergenti. Check-out immediato, consegna sicura.",
    ctaProducts: "Sfoglia i prodotti",
    ctaBlog: "Leggi il blog",
    caption: "{badge} Â· 2025"
  }
};

const pl = {
  brand: { name: "Arte Moderno" },
  nav: { home: "Strona gĹ‚Ăłwna", discover: "Odkrywaj", artists: "ArtyĹ›ci", blog: "Blog", login: "Zaloguj siÄ™" },
  footer: { terms: "Warunki", privacy: "PrywatnoĹ›Ä‡", support: "Wsparcie" },
  home: {
    badge: "WybĂłr kuratora",
    title: "Kolekcja wrzeĹ›niowa",
    subtitle: "Odkryj wspĂłĹ‚czesne prace wschodzÄ…cych artystĂłw. Natychmiastowa pĹ‚atnoĹ›Ä‡, bezpieczna dostawa.",
    ctaProducts: "PrzeglÄ…daj produkty",
    ctaBlog: "Czytaj blog",
    caption: "{badge} Â· 2025"
  }
};

const dictionaries = { cs, en, fr, de, ru, zh, ja, it, pl };

// ---- Kontext / provider ----------------------------------------------------
const I18nCtx = createContext(null);

function getInitialLang() {
  const saved = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
  if (saved && dictionaries[saved]) return saved;
  const nav = typeof navigator !== "undefined" ? navigator.language || navigator.userLanguage : "cs";
  const short = (nav || "cs").slice(0, 2).toLowerCase();
  return dictionaries[short] ? short : "cs";
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);

  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  const dict = dictionaries[lang] || dictionaries.cs;

  const t = useMemo(() => {
    const fn = (key, params = {}) => {
      const parts = String(key).split(".");
      let cur = dict;
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
        else return key; // fallback: vraĹĄ klĂ­ÄŤ
      }
      if (typeof cur === "string") {
        return cur.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
      }
      return key;
    };
    return fn;
  }, [dict]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

