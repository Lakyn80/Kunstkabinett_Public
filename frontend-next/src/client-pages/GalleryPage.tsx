import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ArtworkCard from "@/components/ArtworkCard";
import { fetchArtworks, type Artwork } from "@/data/artworks";
import { fetchArtists } from "@/data/artists";
import { X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

const ITEMS_PER_PAGE = 9;
const VISIBLE_ARTISTS_COUNT = 12;

const GalleryPage = () => {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [artistSearch, setArtistSearch] = useState("");
  const [showAllArtists, setShowAllArtists] = useState(false);

  const artworksQuery = useQuery({
    queryKey: ["artworks", "all", lang],
    queryFn: () => fetchArtworks(lang),
  });
  const artistsQuery = useQuery({
    queryKey: ["artists", "all", lang],
    queryFn: () => fetchArtists(lang),
  });

  const artworks = artworksQuery.data || [];
  const artists = artistsQuery.data || [];

  const categoryFilter = searchParams.get("category") || "";
  const artistFilter = searchParams.get("artist") || "";
  const availabilityFilter = searchParams.get("availability") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const page = Number.parseInt(searchParams.get("page") || "1", 10);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.set("page", "1");
    setSearchParams(params);
  };

  const filtered = useMemo(() => {
    let result = [...artworks];
    if (categoryFilter) result = result.filter((a) => a.category === categoryFilter);
    if (artistFilter) result = result.filter((a) => a.artistSlug === artistFilter);
    if (availabilityFilter) result = result.filter((a) => a.availability === availabilityFilter);

    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "title":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        result.sort((a, b) => Number(b.id) - Number(a.id));
    }
    return result;
  }, [artworks, categoryFilter, artistFilter, availabilityFilter, sortBy]);

  const filteredArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase();
    if (!query) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(query));
  }, [artists, artistSearch]);

  const selectedArtist = artists.find((a) => a.slug === artistFilter);

  const visibleArtists = useMemo(() => {
    if (showAllArtists) return filteredArtists;
    const base = filteredArtists.slice(0, VISIBLE_ARTISTS_COUNT);
    if (!artistFilter || !selectedArtist) return base;
    if (!filteredArtists.some((a) => a.slug === artistFilter)) return base;
    if (base.some((a) => a.slug === artistFilter)) return base;
    return [selectedArtist, ...base];
  }, [showAllArtists, filteredArtists, artistFilter, selectedArtist]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const categoryLabel = t("products.filterByCategory");
  const artistLabel = t("products.filterByArtist");
  const availabilityLabel = pickByLang(lang, {
    cs: "Dostupnost",
    en: "Availability",
    fr: "Disponibilité",
    de: "Verfügbarkeit",
    ru: "Доступность",
    zh: "可用性",
    ja: "在庫状況",
    it: "Disponibilità",
    pl: "Dostępność",
  });
  const clearLabel = t("common.clear");
  const filtersLabel = t("products.filters");
  const newestLabel = pickByLang(lang, { cs: "Nejnovější", en: "Newest", fr: "Les plus récents", de: "Neueste", ru: "Сначала новые", zh: "最新", ja: "新着順", it: "Più recenti", pl: "Najnowsze" });
  const lowHigh = pickByLang(lang, { cs: "Cena: Nejnižší → Nejvyšší", en: "Price: Low → High", fr: "Prix : croissant", de: "Preis: niedrig → hoch", ru: "Цена: по возрастанию", zh: "价格：从低到高", ja: "価格：安い順", it: "Prezzo: crescente", pl: "Cena: rosnąco" });
  const highLow = pickByLang(lang, { cs: "Cena: Nejvyšší → Nejnižší", en: "Price: High → Low", fr: "Prix : décroissant", de: "Preis: hoch → niedrig", ru: "Цена: по убыванию", zh: "价格：从高到低", ja: "価格：高い順", it: "Prezzo: decrescente", pl: "Cena: malejąco" });
  const titleSort = pickByLang(lang, { cs: "Název: A → Z", en: "Title: A → Z", fr: "Titre : A → Z", de: "Titel: A → Z", ru: "Название: А → Я", zh: "标题：A → Z", ja: "タイトル：A → Z", it: "Titolo: A → Z", pl: "Tytuł: A → Z" });
  const loadingArtworks = pickByLang(lang, { cs: "Načítám díla...", en: "Loading artworks...", fr: "Chargement des oeuvres...", de: "Werke werden geladen...", ru: "Загрузка работ...", zh: "正在加载作品...", ja: "作品を読み込み中...", it: "Caricamento opere...", pl: "Ładowanie dzieł..." });
  const noMatch = pickByLang(lang, { cs: "Žádná díla neodpovídají filtrům.", en: "No works match your filters.", fr: "Aucune oeuvre ne correspond aux filtres.", de: "Keine Werke entsprechen den Filtern.", ru: "Нет работ, соответствующих фильтрам.", zh: "没有符合筛选条件的作品。", ja: "フィルターに一致する作品がありません。", it: "Nessuna opera corrisponde ai filtri.", pl: "Brak dzieł spełniających filtry." });
  const clearAll = pickByLang(lang, { cs: "Vymazat všechny filtry", en: "Clear all filters", fr: "Effacer tous les filtres", de: "Alle Filter löschen", ru: "Сбросить все фильтры", zh: "清除所有筛选", ja: "すべてのフィルターをクリア", it: "Cancella tutti i filtri", pl: "Wyczyść wszystkie filtry" });
  const applyFilters = pickByLang(lang, { cs: "Použít filtry", en: "Apply Filters", fr: "Appliquer les filtres", de: "Filter anwenden", ru: "Применить фильтры", zh: "应用筛选", ja: "フィルターを適用", it: "Applica filtri", pl: "Zastosuj filtry" });
  const searchArtistPlaceholder = pickByLang(lang, { cs: "Hledat autora...", en: "Search artist...", fr: "Rechercher un artiste...", de: "Künstler suchen...", ru: "Найти автора...", zh: "搜索艺术家...", ja: "作家を検索...", it: "Cerca artista...", pl: "Szukaj artysty..." });
  const showMoreArtists = pickByLang(lang, { cs: "Zobrazit více", en: "Show more", fr: "Afficher plus", de: "Mehr anzeigen", ru: "Показать больше", zh: "显示更多", ja: "もっと見る", it: "Mostra di più", pl: "Pokaż więcej" });
  const showLessArtists = pickByLang(lang, { cs: "Zobrazit méně", en: "Show less", fr: "Afficher moins", de: "Weniger anzeigen", ru: "Показать меньше", zh: "显示更少", ja: "表示を減らす", it: "Mostra meno", pl: "Pokaż mniej" });
  const noArtistMatch = pickByLang(lang, { cs: "Žádný autor neodpovídá hledání.", en: "No artist matches your search.", fr: "Aucun artiste ne correspond à la recherche.", de: "Kein Künstler entspricht der Suche.", ru: "Нет авторов по запросу.", zh: "没有匹配的艺术家。", ja: "一致する作家がいません。", it: "Nessun artista corrisponde alla ricerca.", pl: "Brak artysty pasującego do wyszukiwania." });

  const getAvailabilityLabel = (availability: Artwork["availability"]) => {
    if (availability === "available") {
      return pickByLang(lang, {
        cs: "Dostupné",
        en: "Available",
        fr: "Disponible",
        de: "Verfügbar",
        ru: "Доступно",
        zh: "可用",
        ja: "利用可能",
        it: "Disponibile",
        pl: "Dostępne",
      });
    }
    if (availability === "reserved") {
      return pickByLang(lang, {
        cs: "Rezervováno",
        en: "Reserved",
        fr: "Réservé",
        de: "Reserviert",
        ru: "Забронировано",
        zh: "已预留",
        ja: "予約済み",
        it: "Riservato",
        pl: "Zarezerwowane",
      });
    }
    return pickByLang(lang, {
      cs: "Prodáno",
      en: "Sold",
      fr: "Vendu",
      de: "Verkauft",
      ru: "Продано",
      zh: "已售出",
      ja: "売却済み",
      it: "Venduto",
      pl: "Sprzedane",
    });
  };

  const renderFilterContent = () => (
    <div className="space-y-8">
      <div>
        <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-sans font-medium">{categoryLabel}</h4>
        {(["painting", "sculpture", "graphic"] as Artwork["category"][]).map((cat) => (
          <label key={cat} className="flex items-center gap-2 py-1.5 cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={categoryFilter === cat}
                onChange={() => setFilter("category", categoryFilter === cat ? "" : cat)}
                className="accent-accent"
              />
              <span className="text-sm capitalize">
              {cat === "painting"
                ? pickByLang(lang, { cs: "Obrazy", en: "Paintings", fr: "Peintures", de: "Gemälde", ru: "Картины", zh: "绘画", ja: "絵画", it: "Dipinti", pl: "Obrazy" })
                : cat === "sculpture"
                  ? pickByLang(lang, { cs: "Sochy", en: "Sculptures", fr: "Sculptures", de: "Skulpturen", ru: "Скульптуры", zh: "雕塑", ja: "彫刻", it: "Sculture", pl: "Rzeźby" })
                  : pickByLang(lang, { cs: "Grafiky", en: "Graphics", fr: "Graphiques", de: "Grafiken", ru: "Графика", zh: "版画", ja: "グラフィック", it: "Grafiche", pl: "Grafiki" })}
            </span>
          </label>
        ))}
        {categoryFilter && (
          <button onClick={() => setFilter("category", "")} className="text-xs text-accent mt-1">
            {clearLabel}
          </button>
        )}
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-sans font-medium">{availabilityLabel}</h4>
        {(["available", "reserved", "sold"] as Artwork["availability"][]).map((av) => (
          <label key={av} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="radio"
              name="availability"
              checked={availabilityFilter === av}
              onChange={() => setFilter("availability", availabilityFilter === av ? "" : av)}
              className="accent-accent"
            />
            <span className="text-sm capitalize">{getAvailabilityLabel(av)}</span>
          </label>
        ))}
        {availabilityFilter && (
          <button onClick={() => setFilter("availability", "")} className="text-xs text-accent mt-1">
            {clearLabel}
          </button>
        )}
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-sans font-medium">{artistLabel}</h4>
        <input
          type="text"
          value={artistSearch}
          onChange={(e) => {
            setArtistSearch(e.target.value);
            setShowAllArtists(false);
          }}
          placeholder={searchArtistPlaceholder}
          className="w-full bg-background border border-border px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent mb-3"
        />
        <div className="max-h-72 overflow-y-auto pr-1 pl-0.5">
          {visibleArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">{noArtistMatch}</p>
          ) : (
            visibleArtists.map((a) => (
              <label key={a.slug} className="flex items-center gap-2 py-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="artist"
                  checked={artistFilter === a.slug}
                  onChange={() => setFilter("artist", artistFilter === a.slug ? "" : a.slug)}
                  className="h-5 w-5 shrink-0 m-0 accent-accent"
                />
                <span className="text-sm">{a.name}</span>
              </label>
            ))
          )}
        </div>
        {filteredArtists.length > visibleArtists.length && (
          <button onClick={() => setShowAllArtists(true)} className="text-xs text-accent mt-2">
            {showMoreArtists}
          </button>
        )}
        {showAllArtists && filteredArtists.length > VISIBLE_ARTISTS_COUNT && (
          <button onClick={() => setShowAllArtists(false)} className="text-xs text-accent mt-2 ml-3">
            {showLessArtists}
          </button>
        )}
        {artistFilter && (
          <button onClick={() => setFilter("artist", "")} className="text-xs text-accent mt-2">
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="pt-24 md:pt-32">
        <div className="container mx-auto px-6">
          <SectionHeader title={t("products.title")} subtitle={`${filtered.length} ${pickByLang(lang, { cs: "děl", en: "works", fr: "oeuvres", de: "Werke", ru: "работ", zh: "件作品", ja: "作品", it: "opere", pl: "dzieł" })}`} />

          <div className="flex items-center justify-between mb-8">
            <button onClick={() => setMobileFiltersOpen(true)} className="md:hidden flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="w-4 h-4" /> {filtersLabel}
            </button>
            <select
              value={sortBy}
              onChange={(e) => setFilter("sort", e.target.value)}
              className="bg-background border border-border px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent ml-auto"
            >
              <option value="newest">{newestLabel}</option>
              <option value="price-asc">{lowHigh}</option>
              <option value="price-desc">{highLow}</option>
              <option value="title">{titleSort}</option>
            </select>
          </div>

          <div className="flex gap-10">
            <aside className="hidden md:block w-56 flex-shrink-0">
              {renderFilterContent()}
            </aside>

            <div className="flex-1">
              {artworksQuery.isLoading ? (
                <p className="text-muted-foreground py-8">{loadingArtworks}</p>
              ) : paginated.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-muted-foreground">{noMatch}</p>
                  <button onClick={() => setSearchParams({})} className="text-accent text-sm mt-2">
                    {clearAll}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {paginated.map((artwork) => (
                    <ArtworkCard key={artwork.id} artwork={artwork} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilter("page", String(p))}
                      className={`w-10 h-10 text-sm rounded-sm transition-colors ${
                        p === safePage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h3 className="font-serif text-lg">{filtersLabel}</h3>
            <button onClick={() => setMobileFiltersOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            {renderFilterContent()}
            <Button onClick={() => setMobileFiltersOpen(false)} className="w-full mt-8 uppercase tracking-wider text-xs">
              {applyFilters}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GalleryPage;
