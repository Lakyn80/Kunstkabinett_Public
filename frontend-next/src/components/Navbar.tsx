import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Search, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n/I18nProvider";
import { SUPPORTED_LANGUAGES, pickByLang } from "@/i18n/config";
import { useCart } from "@/modules/common/CartContext";
import { useAuth } from "@/modules/auth/AuthContext";
import { fetchArtworks } from "@/data/artworks";
import { fetchArtists } from "@/data/artists";

const navLinks = [
  { key: "nav.discover", href: "/gallery" },
  { key: "nav.artists", href: "/artists" },
  { key: "nav.blog", href: "/blog" },
  { key: "nav.about", href: "/about" },
  { key: "nav.contact", href: "/contact" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { totals } = useCart() as { totals?: { count?: number } };
  const { user, logout } = useAuth() as { user?: unknown; logout: () => Promise<void> };
  const isLoggedIn = !!user || (typeof window !== "undefined" && !!localStorage.getItem("am_client_token"));
  const cartCount = totals?.count || 0;
  const signedInLabel = pickByLang(lang, {
    cs: "Přihlášen",
    en: "Signed in",
    fr: "Connecté",
    de: "Angemeldet",
    ru: "Вход выполнен",
    zh: "已登录",
    ja: "ログイン中",
    it: "Connesso",
    pl: "Zalogowany",
  });

  const artworksSearchQuery = useQuery({
    queryKey: ["navbar-search", "artworks", lang],
    queryFn: () => fetchArtworks(lang),
    enabled: searchOpen,
  });

  const artistsSearchQuery = useQuery({
    queryKey: ["navbar-search", "artists", lang],
    queryFn: () => fetchArtists(lang),
    enabled: searchOpen,
  });

  const searchPlaceholder = pickByLang(lang, {
    cs: "Hledat autora nebo dílo...",
    en: "Search artist or artwork...",
    fr: "Rechercher un artiste ou une oeuvre...",
    de: "Künstler oder Werk suchen...",
    ru: "Поиск автора или работы...",
    zh: "搜索艺术家或作品...",
    ja: "作家または作品を検索...",
    it: "Cerca artista o opera...",
    pl: "Szukaj artysty lub dzieła...",
  });
  const searchArtistsLabel = pickByLang(lang, {
    cs: "Autoři",
    en: "Artists",
    fr: "Artistes",
    de: "Künstler",
    ru: "Авторы",
    zh: "艺术家",
    ja: "作家",
    it: "Artisti",
    pl: "Artyści",
  });
  const searchArtworksLabel = pickByLang(lang, {
    cs: "Díla",
    en: "Artworks",
    fr: "Oeuvres",
    de: "Werke",
    ru: "Работы",
    zh: "作品",
    ja: "作品",
    it: "Opere",
    pl: "Dzieła",
  });
  const searchNoResults = pickByLang(lang, {
    cs: "Nenalezeny žádné výsledky.",
    en: "No results found.",
    fr: "Aucun résultat trouvé.",
    de: "Keine Ergebnisse gefunden.",
    ru: "Результаты не найдены.",
    zh: "未找到结果。",
    ja: "結果が見つかりません。",
    it: "Nessun risultato trovato.",
    pl: "Nie znaleziono wyników.",
  });
  const searchTypeHint = pickByLang(lang, {
    cs: "Začněte psát pro vyhledání autora nebo díla.",
    en: "Start typing to search artists and artworks.",
    fr: "Commencez à taper pour rechercher artistes et oeuvres.",
    de: "Tippen Sie, um Künstler und Werke zu suchen.",
    ru: "Начните ввод для поиска авторов и работ.",
    zh: "开始输入以搜索艺术家和作品。",
    ja: "入力して作家や作品を検索。",
    it: "Inizia a digitare per cercare artisti e opere.",
    pl: "Zacznij pisać, aby wyszukać artystów i dzieła.",
  });

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const allArtworks = artworksSearchQuery.data || [];
  const allArtists = artistsSearchQuery.data || [];

  const matchedArtists = useMemo(() => {
    if (!normalizedSearch) return [];
    return allArtists.filter((artist) => artist.name.toLowerCase().includes(normalizedSearch)).slice(0, 6);
  }, [allArtists, normalizedSearch]);

  const matchedArtworks = useMemo(() => {
    if (!normalizedSearch) return [];
    return allArtworks
      .filter(
        (artwork) =>
          artwork.title.toLowerCase().includes(normalizedSearch) ||
          artwork.artistName.toLowerCase().includes(normalizedSearch),
      )
      .slice(0, 6);
  }, [allArtworks, normalizedSearch]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setMobileOpen(false);
      navigate("/");
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }, [location.pathname]);

  const registerLabel = pickByLang(lang, {
    cs: "Registrace",
    en: "Register",
    fr: "Inscription",
    de: "Registrieren",
    ru: "Регистрация",
    zh: "注册",
    ja: "登録",
    it: "Registrati",
    pl: "Rejestracja",
  });

  const getNavLabel = (key: string) => {
    if (key === "nav.discover") {
      return pickByLang(lang, {
        cs: "Galerie",
        en: "Gallery",
        fr: "Galerie",
        de: "Galerie",
        ru: "Галерея",
        zh: "画廊",
        ja: "ギャラリー",
        it: "Galleria",
        pl: "Galeria",
      });
    }
    if (key === "nav.about") {
      return pickByLang(lang, {
        cs: "O nás",
        en: "About us",
        fr: "À propos",
        de: "Über uns",
        ru: "О нас",
        zh: "关于我们",
        ja: "私たちについて",
        it: "Chi siamo",
        pl: "O nas",
      });
    }
    return t(key);
  };

  const onSearchResultClick = (to: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(to);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300 ${
          scrolled
            ? "bg-background/90 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <nav className="container mx-auto flex items-center justify-between h-16 md:h-20 px-6">
          <Link to="/" className={`font-serif text-xl md:text-2xl tracking-tight ${location.pathname === "/" && !scrolled ? "text-white" : "text-black"}`}>
            Kunstkabinett
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm tracking-wide transition-colors duration-200 hover:text-accent ${
                  location.pathname.startsWith(link.href) ? "text-accent" : "text-muted-foreground"
                }`}
              >
                {getNavLabel(link.key)}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="appearance-none rounded-full border border-border bg-background pl-3 pr-8 py-1 text-xs text-muted-foreground"
                aria-label="Language"
                style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none", backgroundImage: "none" }}
              >
                {SUPPORTED_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code.toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="relative">
              <button
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t("common.search")}
                onClick={() => setSearchOpen((open) => !open)}
                type="button"
              >
                <Search className="w-4 h-4" />
              </button>
              {searchOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(92vw,30rem)] rounded-sm border border-border bg-background shadow-lg p-3 z-50">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                  <div className="mt-3 max-h-80 overflow-y-auto space-y-3">
                    {!normalizedSearch ? (
                      <p className="text-xs text-muted-foreground">{searchTypeHint}</p>
                    ) : artworksSearchQuery.isLoading || artistsSearchQuery.isLoading ? (
                      <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
                    ) : matchedArtists.length === 0 && matchedArtworks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{searchNoResults}</p>
                    ) : (
                      <>
                        {matchedArtists.length > 0 && (
                          <div>
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{searchArtistsLabel}</p>
                            <div className="space-y-1">
                              {matchedArtists.map((artist) => (
                                <button
                                  key={artist.id}
                                  type="button"
                                  onClick={() => onSearchResultClick(`/artists/${artist.slug}`)}
                                  className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-secondary transition-colors"
                                >
                                  {artist.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {matchedArtworks.length > 0 && (
                          <div>
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{searchArtworksLabel}</p>
                            <div className="space-y-1">
                              {matchedArtworks.map((artwork) => (
                                <button
                                  key={artwork.id}
                                  type="button"
                                  onClick={() => onSearchResultClick(`/gallery/${artwork.slug}`)}
                                  className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-secondary transition-colors"
                                >
                                  {artwork.title}
                                  <span className="text-muted-foreground"> · {artwork.artistName}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2">
            {isLoggedIn && (
              <span
                className="rounded-full border border-border px-3 py-1.5 text-xs tracking-wider text-foreground hover:bg-secondary transition-colors"
              >
                {signedInLabel}
              </span>
            )}
            {isLoggedIn && (
              <Link
                to="/account"
                className="rounded-full border border-border px-3 py-1.5 text-xs tracking-wider text-foreground hover:bg-secondary transition-colors"
              >
                {t("nav.account")}
              </Link>
            )}
            {isLoggedIn && (
              <Link
                to="/cart"
                className="rounded-full border border-border px-3 py-1.5 text-xs tracking-wider text-foreground hover:bg-secondary transition-colors"
              >
                  {t("nav.cart")}{cartCount > 0 ? ` (${cartCount})` : ""}
                </Link>
              )}
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-border px-3 py-1.5 text-xs tracking-wider text-foreground hover:bg-secondary transition-colors"
                >
                  {t("nav.logout")}
                </button>
              )}
              {!isLoggedIn && (
                <Link
                  to="/register"
                  className="rounded-full border border-border px-3 py-1.5 text-xs tracking-wider text-foreground hover:bg-secondary transition-colors"
                >
                  {registerLabel}
                </Link>
              )}
              {!isLoggedIn && (
                <Link
                  to="/login"
                  className="rounded-full bg-primary px-3 py-1.5 text-xs tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t("nav.login")}
                </Link>
              )}
            </div>
            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          <div className="flex items-center justify-between h-16 px-6">
            <Link to="/" className="font-serif text-xl tracking-tight text-foreground">
              Kunstkabinett
            </Link>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="appearance-none rounded-full border border-border bg-background pl-3 pr-8 py-1.5 text-sm text-foreground"
                aria-label="Language"
                style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none", backgroundImage: "none" }}
              >
                {SUPPORTED_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code.toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="font-serif text-3xl text-foreground hover:text-accent transition-colors"
              >
                {getNavLabel(link.key)}
              </Link>
            ))}
            {isLoggedIn && (
              <span
                className="rounded-full border border-border px-4 py-2 text-sm tracking-wider text-foreground hover:bg-secondary transition-colors"
              >
                {signedInLabel}
              </span>
            )}
            {isLoggedIn && (
              <Link
                to="/account"
                className="rounded-full border border-border px-4 py-2 text-sm tracking-wider text-foreground hover:bg-secondary transition-colors"
              >
                {t("nav.account")}
              </Link>
            )}
            {isLoggedIn && (
              <Link
                to="/cart"
                className="rounded-full border border-border px-4 py-2 text-sm tracking-wider text-foreground hover:bg-secondary transition-colors"
              >
                {t("nav.cart")}{cartCount > 0 ? ` (${cartCount})` : ""}
              </Link>
            )}
            {isLoggedIn && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-border px-4 py-2 text-sm tracking-wider text-foreground hover:bg-secondary transition-colors"
              >
                {t("nav.logout")}
              </button>
            )}
            {!isLoggedIn && (
              <div className="mt-4 flex items-center gap-3">
                <Link
                  to="/register"
                  className="rounded-full border border-border px-4 py-2 text-sm tracking-wider text-foreground hover:bg-secondary transition-colors"
                >
                  {registerLabel}
                </Link>
                <Link
                  to="/login"
                  className="rounded-full bg-primary px-4 py-2 text-sm tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t("nav.login")}
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
};

export default Navbar;
