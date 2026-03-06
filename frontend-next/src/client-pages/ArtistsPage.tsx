import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ArtistCard from "@/components/ArtistCard";
import { fetchArtists } from "@/data/artists";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

const VISIBLE_ARTISTS_COUNT = 12;

const ArtistsPage = () => {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [artistSearch, setArtistSearch] = useState("");
  const [showAllArtists, setShowAllArtists] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["artists", "all", lang],
    queryFn: () => fetchArtists(lang),
  });

  const artistFilter = searchParams.get("artist") || "";

  const setArtistFilter = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("artist", value);
    else params.delete("artist");
    setSearchParams(params);
  };

  const filteredArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase();
    if (!query) return data;
    return data.filter((artist) => artist.name.toLowerCase().includes(query));
  }, [data, artistSearch]);

  const selectedArtist = data.find((artist) => artist.slug === artistFilter);

  const visibleFilterArtists = useMemo(() => {
    if (showAllArtists) return filteredArtists;
    const base = filteredArtists.slice(0, VISIBLE_ARTISTS_COUNT);
    if (!artistFilter || !selectedArtist) return base;
    if (!filteredArtists.some((artist) => artist.slug === artistFilter)) return base;
    if (base.some((artist) => artist.slug === artistFilter)) return base;
    return [selectedArtist, ...base];
  }, [showAllArtists, filteredArtists, artistFilter, selectedArtist]);

  const visibleCards = useMemo(() => {
    if (!artistFilter) return data;
    return data.filter((artist) => artist.slug === artistFilter);
  }, [data, artistFilter]);

  const artistLabel = t("products.filterByArtist");
  const clearLabel = t("common.clear");
  const searchArtistPlaceholder = pickByLang(lang, { cs: "Hledat autora...", en: "Search artist...", fr: "Rechercher un artiste...", de: "Künstler suchen...", ru: "Найти автора...", zh: "搜索艺术家...", ja: "作家を検索...", it: "Cerca artista...", pl: "Szukaj artysty..." });
  const showMoreArtists = pickByLang(lang, { cs: "Zobrazit více", en: "Show more", fr: "Afficher plus", de: "Mehr anzeigen", ru: "Показать больше", zh: "显示更多", ja: "もっと見る", it: "Mostra di più", pl: "Pokaż więcej" });
  const showLessArtists = pickByLang(lang, { cs: "Zobrazit méně", en: "Show less", fr: "Afficher moins", de: "Weniger anzeigen", ru: "Показать меньше", zh: "显示更少", ja: "表示を減らす", it: "Mostra meno", pl: "Pokaż mniej" });
  const noArtistMatch = pickByLang(lang, { cs: "Žádný autor neodpovídá hledání.", en: "No artist matches your search.", fr: "Aucun artiste ne correspond à la recherche.", de: "Kein Künstler entspricht der Suche.", ru: "Нет авторов по запросу.", zh: "没有匹配的艺术家。", ja: "一致する作家がいません。", it: "Nessun artista corrisponde alla ricerca.", pl: "Brak artysty pasującego do wyszukiwania." });

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <SectionHeader
            title={t("artists.title")}
            subtitle={pickByLang(lang, { en: "Meet the creators behind the collection.", cs: "Seznamte se s autory kolekce." })}
          />
          {isLoading ? (
            <p className="text-muted-foreground">{t("artists.loading")}</p>
          ) : (
            <div className="flex flex-col md:flex-row gap-10">
              <aside className="md:w-56 md:flex-shrink-0">
                <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-sans font-medium">{artistLabel}</h4>
                <input
                  type="text"
                  value={artistSearch}
                  onChange={(event) => {
                    setArtistSearch(event.target.value);
                    setShowAllArtists(false);
                  }}
                  placeholder={searchArtistPlaceholder}
                  className="w-full bg-background border border-border px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent mb-3"
                />
                <div className="max-h-72 overflow-y-auto pr-1 pl-0.5">
                  {visibleFilterArtists.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-1">{noArtistMatch}</p>
                  ) : (
                    visibleFilterArtists.map((artist) => (
                      <label key={artist.slug} className="flex items-center gap-2 py-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="artist"
                          checked={artistFilter === artist.slug}
                          onChange={() => setArtistFilter(artistFilter === artist.slug ? "" : artist.slug)}
                          className="h-5 w-5 shrink-0 m-0 accent-accent"
                        />
                        <span className="text-sm">{artist.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {filteredArtists.length > visibleFilterArtists.length && (
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
                  <button onClick={() => setArtistFilter("")} className="text-xs text-accent mt-2">
                    {clearLabel}
                  </button>
                )}
              </aside>

              <div className="flex-1">
                {visibleCards.length === 0 ? (
                  <p className="text-muted-foreground">{t("artists.noArtists")}</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                    {visibleCards.map((artist) => (
                      <ArtistCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ArtistsPage;
