import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import ArtworkCard from "@/components/ArtworkCard";
import { fetchArtistBySlug } from "@/data/artists";
import { fetchArtworksByArtist } from "@/data/artworks";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

const ArtistDetailPage = () => {
  const { t, lang } = useI18n();
  const { slug = "" } = useParams<{ slug: string }>();
  const [sortBy, setSortBy] = useState("newest");

  const artistQuery = useQuery({
    queryKey: ["artists", slug, lang],
    queryFn: () => fetchArtistBySlug(slug, lang),
    enabled: !!slug,
  });

  const worksQuery = useQuery({
    queryKey: ["artists", slug, "artworks", lang],
    queryFn: () => fetchArtworksByArtist(slug, lang),
    enabled: !!slug,
  });

  const artist = artistQuery.data;
  const works = worksQuery.data || [];

  if (artistQuery.isLoading) {
    return (
      <Layout>
        <div className="pt-32 container mx-auto px-6 py-20 text-muted-foreground">{t("artists.loading")}</div>
      </Layout>
    );
  }

  if (!artist) {
    return (
      <Layout>
        <div className="pt-32 container mx-auto px-6 text-center py-20">
          <h1 className="font-serif text-3xl mb-4">{pickByLang(lang, { cs: "Umělec nebyl nalezen", en: "Artist not found", fr: "Artiste introuvable", de: "Künstler nicht gefunden", ru: "Художник не найден", zh: "未找到艺术家", ja: "アーティストが見つかりません", it: "Artista non trovato", pl: "Nie znaleziono artysty" })}</h1>
          <Link to="/artists" className="text-accent">
            ← {pickByLang(lang, { cs: "Zpět na umělce", en: "Back to Artists", fr: "Retour aux artistes", de: "Zurück zu Künstlern", ru: "Назад к художникам", zh: "返回艺术家列表", ja: "アーティスト一覧へ戻る", it: "Torna agli artisti", pl: "Powrót do artystów" })}
          </Link>
        </div>
      </Layout>
    );
  }

  const sorted = [...works].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      default:
        return Number(b.id) - Number(a.id);
    }
  });

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <Link to="/artists" className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block">
            ← {pickByLang(lang, { cs: "Zpět na umělce", en: "Back to Artists", fr: "Retour aux artistes", de: "Zurück zu Künstlern", ru: "Назад к художникам", zh: "返回艺术家列表", ja: "アーティスト一覧へ戻る", it: "Torna agli artisti", pl: "Powrót do artystów" })}
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16 md:mb-24">
            <div className="aspect-square overflow-hidden bg-secondary/50">
              <img src={artist.portrait} alt={artist.name} className="w-full h-full object-cover" />
            </div>
            <div className="md:col-span-2 flex flex-col justify-center">
              <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-4">{artist.name}</h1>
              <p className="text-muted-foreground text-lg mb-6">{artist.bioShort}</p>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                {artist.bioFull.split("\n\n").map((p, i) => (
                  <p key={i} className="mb-4 leading-relaxed text-sm">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between mb-10">
            <h2 className="font-serif text-2xl md:text-3xl">{t("artists.works")} ({works.length})</h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-background border border-border px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="newest">{pickByLang(lang, { cs: "Nejnovější", en: "Newest", fr: "Les plus récents", de: "Neueste", ru: "Сначала новые", zh: "最新", ja: "新着順", it: "Più recenti", pl: "Najnowsze" })}</option>
              <option value="price-asc">{pickByLang(lang, { cs: "Cena: Nejnižší → Nejvyšší", en: "Price: Low → High", fr: "Prix : croissant", de: "Preis: niedrig → hoch", ru: "Цена: по возрастанию", zh: "价格：从低到高", ja: "価格：安い順", it: "Prezzo: crescente", pl: "Cena: rosnąco" })}</option>
              <option value="price-desc">{pickByLang(lang, { cs: "Cena: Nejvyšší → Nejnižší", en: "Price: High → Low", fr: "Prix : décroissant", de: "Preis: hoch → niedrig", ru: "Цена: по убыванию", zh: "价格：从高到低", ja: "価格：高い順", it: "Prezzo: decrescente", pl: "Cena: malejąco" })}</option>
            </select>
          </div>
          {worksQuery.isLoading ? (
            <p className="text-muted-foreground">{pickByLang(lang, { cs: "Načítám díla...", en: "Loading artworks...", fr: "Chargement des oeuvres...", de: "Werke werden geladen...", ru: "Загрузка работ...", zh: "正在加载作品...", ja: "作品を読み込み中...", it: "Caricamento opere...", pl: "Ładowanie dzieł..." })}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {sorted.map((artwork) => (
                <ArtworkCard key={artwork.id} artwork={artwork} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ArtistDetailPage;
