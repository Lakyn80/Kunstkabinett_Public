import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ArtworkCard from "@/components/ArtworkCard";
import ArtistCard from "@/components/ArtistCard";
import BlogCard from "@/components/BlogCard";
import { fetchArtworks, fetchFeaturedArtworks } from "@/data/artworks";
import { fetchArtists } from "@/data/artists";
import { fetchPublishedPosts } from "@/data/blog";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

const HERO_MAIN_IMAGE = "/uploads/products/ID_33_S.webp";

const Index = () => {
  const { t, lang } = useI18n();

  const artworksQuery = useQuery({
    queryKey: ["artworks", "all", lang],
    queryFn: () => fetchArtworks(lang),
  });

  const featuredQuery = useQuery({
    queryKey: ["artworks", "featured", lang],
    queryFn: () => fetchFeaturedArtworks(8, lang),
  });

  const artistsQuery = useQuery({
    queryKey: ["artists", "all", lang],
    queryFn: () => fetchArtists(lang),
  });

  const postsQuery = useQuery({
    queryKey: ["blog", "published", lang],
    queryFn: () => fetchPublishedPosts(lang),
  });

  const artworks = artworksQuery.data || [];
  const featured = featuredQuery.data || [];
  const featuredArtistKeys = useMemo(() => {
    return new Set(
      featured.flatMap((item) => {
        const slug = String(item.artistSlug || "").trim().toLowerCase();
        const name = String(item.artistName || "").trim().toLowerCase();
        return [slug, name].filter(Boolean);
      }),
    );
  }, [featured]);

  const artists = useMemo(() => {
    return (artistsQuery.data || [])
      .filter((artist) => {
        const slug = String(artist.slug || "").trim().toLowerCase();
        const name = String(artist.name || "").trim().toLowerCase();
        return featuredArtistKeys.has(slug) || featuredArtistKeys.has(name);
      })
      .slice(0, 5);
  }, [artistsQuery.data, featuredArtistKeys]);

  const latestPosts = (postsQuery.data || []).slice(0, 3);

  const categories = useMemo(
    () => [
      {
        title: pickByLang(lang, {
          cs: "Obrazy",
          en: "Paintings",
          fr: "Peintures",
          de: "Gemälde",
          ru: "Картины",
          zh: "绘画",
          ja: "絵画",
          it: "Dipinti",
          pl: "Obrazy",
        }),
        slug: "painting",
        count: artworks.filter((a) => a.category === "painting").length,
        image:
          "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&h=500&fit=crop",
      },
      {
        title: pickByLang(lang, {
          cs: "Sochy",
          en: "Sculptures",
          fr: "Sculptures",
          de: "Skulpturen",
          ru: "Скульптуры",
          zh: "雕塑",
          ja: "彫刻",
          it: "Sculture",
          pl: "Rzeźby",
        }),
        slug: "sculpture",
        count: artworks.filter((a) => a.category === "sculpture").length,
        image:
          "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=800&h=500&fit=crop",
      },
      {
        title: pickByLang(lang, {
          cs: "Grafiky",
          en: "Graphics",
          fr: "Graphiques",
          de: "Grafiken",
          ru: "Графика",
          zh: "版画",
          ja: "グラフィック",
          it: "Grafiche",
          pl: "Grafiki",
        }),
        slug: "graphic",
        count: artworks.filter((a) => a.category === "graphic").length,
        image:
          "https://images.unsplash.com/photo-1482160549825-59d1b23cb208?w=800&h=500&fit=crop",
      },
    ],
    [artworks, lang],
  );

  const heroTitle = pickByLang(lang, {
    cs: "Aktuální kolekce",
    en: "Current Collection",
    fr: "Collection actuelle",
    de: "Aktuelle Kollektion",
    ru: "Актуальная коллекция",
    zh: "当前系列",
    ja: "最新コレクション",
    it: "Collezione attuale",
    pl: "Aktualna kolekcja",
  });
  const heroSubtitle = pickByLang(lang, {
    cs: "Objevte výběr současného umění – originální obrazy a sochy pečlivě vybrané pro naši galerii.",
    en: "Discover selected contemporary art - original paintings and sculptures carefully curated for our gallery.",
    fr: "Découvrez une sélection d'art contemporain - peintures et sculptures originales soigneusement choisies pour notre galerie.",
    de: "Entdecken Sie eine Auswahl zeitgenössischer Kunst - originale Gemälde und Skulpturen, sorgfältig für unsere Galerie kuratiert.",
    ru: "Откройте подборку современного искусства - оригинальные картины и скульптуры, тщательно отобранные для нашей галереи.",
    zh: "探索当代艺术精选 - 为画廊精心挑选的原创绘画与雕塑。",
    ja: "現代アートの厳選作品をご覧ください。ギャラリーのために丁寧に選んだオリジナルの絵画と彫刻です。",
    it: "Scopri una selezione di arte contemporanea - dipinti e sculture originali scelti con cura per la nostra galleria.",
    pl: "Odkryj wybór sztuki współczesnej - oryginalne obrazy i rzeźby starannie wybrane do naszej galerii.",
  });
  const heroCtaProducts = pickByLang(lang, {
    cs: "Prohlédnout díla",
    en: "Browse Works",
    fr: "Voir les oeuvres",
    de: "Werke ansehen",
    ru: "Смотреть работы",
    zh: "查看作品",
    ja: "作品を見る",
    it: "Guarda le opere",
    pl: "Zobacz dzieła",
  });

  const worksLabel = pickByLang(lang, {
    en: "works",
    cs: "děl",
    fr: "oeuvres",
    de: "Werke",
    ru: "работ",
    zh: "件作品",
    ja: "作品",
    it: "opere",
    pl: "dzieł",
  });
  const exploreByMedium = pickByLang(lang, {
    en: "Explore by Medium",
    cs: "Prozkoumat podle média",
    fr: "Explorer par médium",
    de: "Nach Medium entdecken",
    ru: "Исследовать по технике",
    zh: "按媒介探索",
    ja: "メディア別に探す",
    it: "Esplora per tecnica",
    pl: "Odkrywaj według medium",
  });
  const exploreByMediumSub = pickByLang(lang, {
    en: "Discover works across painting, sculpture, and graphic art.",
    cs: "Objevte díla napříč obrazy, sochami a grafikou.",
    fr: "Découvrez des oeuvres de peinture, sculpture et art graphique.",
    de: "Entdecken Sie Werke aus Malerei, Skulptur und Grafik.",
    ru: "Откройте работы в живописи, скульптуре и графике.",
    zh: "探索绘画、雕塑与版画作品。",
    ja: "絵画、彫刻、グラフィック作品を見つけてください。",
    it: "Scopri opere tra pittura, scultura e grafica.",
    pl: "Odkryj dzieła z malarstwa, rzeźby i grafiki.",
  });
  const featuredTitle = pickByLang(lang, {
    en: "Featured Works",
    cs: "Vybraná díla",
    fr: "Oeuvres en vedette",
    de: "Ausgewählte Werke",
    ru: "Избранные работы",
    zh: "精选作品",
    ja: "注目作品",
    it: "Opere in evidenza",
    pl: "Wybrane dzieła",
  });
  const featuredSub = pickByLang(lang, {
    en: "Hand-selected pieces from our current collection.",
    cs: "Ručně vybraná díla z aktuální kolekce.",
    fr: "Pièces sélectionnées à la main de notre collection actuelle.",
    de: "Von Hand ausgewählte Stücke aus unserer aktuellen Kollektion.",
    ru: "Работы, вручную отобранные из нашей текущей коллекции.",
    zh: "从当前馆藏中手工甄选的作品。",
    ja: "現在のコレクションから厳選した作品です。",
    it: "Opere selezionate a mano dalla nostra collezione attuale.",
    pl: "Ręcznie wybrane prace z naszej aktualnej kolekcji.",
  });
  const artistsTitle = pickByLang(lang, {
    en: "Our Artists",
    cs: "Naši umělci",
    fr: "Nos artistes",
    de: "Unsere Künstler",
    ru: "Наши художники",
    zh: "我们的艺术家",
    ja: "アーティスト",
    it: "I nostri artisti",
    pl: "Nasi artyści",
  });
  const artistsSub = pickByLang(lang, {
    en: "Meet the creators behind the collection.",
    cs: "Seznamte se s autory této kolekce.",
    fr: "Découvrez les créateurs de cette collection.",
    de: "Lernen Sie die Schöpfer dieser Kollektion kennen.",
    ru: "Познакомьтесь с авторами этой коллекции.",
    zh: "认识这套收藏背后的创作者。",
    ja: "このコレクションの作家をご紹介します。",
    it: "Scopri gli artisti dietro questa collezione.",
    pl: "Poznaj twórców tej kolekcji.",
  });
  const journalTitle = pickByLang(lang, {
    en: "Journal",
    cs: "Blog",
    fr: "Journal",
    de: "Journal",
    ru: "Блог",
    zh: "博客",
    ja: "ブログ",
    it: "Blog",
    pl: "Blog",
  });
  const journalSub = pickByLang(lang, {
    en: "Insights, interviews, and guides from the art world.",
    cs: "Zajímavosti, rozhovory a průvodci ze světa umění.",
    fr: "Analyses, entretiens et guides du monde de l'art.",
    de: "Einblicke, Interviews und Leitfäden aus der Kunstwelt.",
    ru: "Инсайты, интервью и гиды из мира искусства.",
    zh: "来自艺术世界的见解、访谈与指南。",
    ja: "アート界の洞察、インタビュー、ガイド。",
    it: "Approfondimenti, interviste e guide dal mondo dell'arte.",
    pl: "Wglądy, wywiady i przewodniki ze świata sztuki.",
  });
  const viewAll = pickByLang(lang, {
    en: "View all",
    cs: "Zobrazit vše",
    fr: "Voir tout",
    de: "Alle anzeigen",
    ru: "Смотреть все",
    zh: "查看全部",
    ja: "すべて見る",
    it: "Vedi tutto",
    pl: "Zobacz wszystkie",
  });
  const allArticles = pickByLang(lang, {
    en: "All articles",
    cs: "Všechny články",
    fr: "Tous les articles",
    de: "Alle Artikel",
    ru: "Все статьи",
    zh: "所有文章",
    ja: "すべての記事",
    it: "Tutti gli articoli",
    pl: "Wszystkie artykuły",
  });
  const loadingFeatured = pickByLang(lang, {
    en: "Loading featured works...",
    cs: "Načítám vybraná díla...",
    fr: "Chargement des oeuvres en vedette...",
    de: "Ausgewählte Werke werden geladen...",
    ru: "Загрузка избранных работ...",
    zh: "正在加载精选作品...",
    ja: "注目作品を読み込み中...",
    it: "Caricamento opere in evidenza...",
    pl: "Ładowanie wybranych dzieł...",
  });
  const loadingArtists = pickByLang(lang, {
    en: "Loading artists...",
    cs: "Načítám umělce...",
    fr: "Chargement des artistes...",
    de: "Künstler werden geladen...",
    ru: "Загрузка художников...",
    zh: "正在加载艺术家...",
    ja: "アーティストを読み込み中...",
    it: "Caricamento artisti...",
    pl: "Ładowanie artystów...",
  });
  const loadingJournal = pickByLang(lang, {
    en: "Loading journal...",
    cs: "Načítám blog...",
    fr: "Chargement du journal...",
    de: "Journal wird geladen...",
    ru: "Загрузка блога...",
    zh: "正在加载博客...",
    ja: "ブログを読み込み中...",
    it: "Caricamento blog...",
    pl: "Ładowanie bloga...",
  });
  const privateViewing = pickByLang(lang, {
    en: "Request a Private Viewing",
    cs: "Požádejte o soukromou prohlídku",
    fr: "Demander une visite privée",
    de: "Private Besichtigung anfragen",
    ru: "Запросить частный просмотр",
    zh: "预约私人观展",
    ja: "プライベートビューイングを申し込む",
    it: "Richiedi una visita privata",
    pl: "Poproś o prywatne oglądanie",
  });
  const privateViewingSub = pickByLang(lang, {
    en: "Experience our collection in person. We offer private viewings and consultations by appointment.",
    cs: "Zažijte naši kolekci osobně. Nabízíme soukromé prohlídky a konzultace po domluvě.",
    fr: "Découvrez notre collection en personne. Nous proposons des visites privées et des consultations sur rendez-vous.",
    de: "Erleben Sie unsere Kollektion persönlich. Wir bieten private Besichtigungen und Beratungen nach Vereinbarung.",
    ru: "Ознакомьтесь с коллекцией лично. Мы проводим частные просмотры и консультации по записи.",
    zh: "亲临体验我们的收藏。我们提供预约制私人导览与咨询。",
    ja: "コレクションを実際にご覧ください。予約制のプライベート内覧とご相談を承ります。",
    it: "Vivi la nostra collezione dal vivo. Offriamo visite private e consulenze su appuntamento.",
    pl: "Poznaj naszą kolekcję osobiście. Oferujemy prywatne oglądanie i konsultacje po umówieniu.",
  });
  const getInTouch = pickByLang(lang, {
    en: "Get in Touch",
    cs: "Kontaktujte nás",
    fr: "Contactez-nous",
    de: "Kontakt aufnehmen",
    ru: "Связаться с нами",
    zh: "联系我们",
    ja: "お問い合わせ",
    it: "Contattaci",
    pl: "Skontaktuj się z nami",
  });

  return (
    <Layout>
      <section className="relative h-screen flex items-end">
        <div className="absolute inset-0">
          <img
            src={HERO_MAIN_IMAGE}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover hero-image-fade"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/58 to-black/24" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),rgba(0,0,0,0.50)_72%)]" />
        </div>
        <div className="relative container mx-auto px-6 pb-20 md:pb-28">
          <p className="text-xs uppercase tracking-[0.3em] text-primary-foreground/70 mb-4 font-sans">
            {t("home.badge")}
          </p>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-primary-foreground max-w-3xl leading-[1.1] mb-6">
            {heroTitle}
          </h1>
          <p className="text-primary-foreground/80 text-base md:text-lg max-w-xl mb-8">
            {heroSubtitle}
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" className="uppercase tracking-wider text-xs">
              <Link to="/gallery">{heroCtaProducts}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="uppercase tracking-wider text-xs border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/artists">{t("nav.artists")}</Link>
            </Button>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ArrowDown className="w-5 h-5 text-primary-foreground/50" />
        </div>
      </section>

      <section className="container mx-auto px-6 py-20 md:py-28">
        <SectionHeader title={exploreByMedium} subtitle={exploreByMediumSub} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {categories.map((cat) => (
            <Link key={cat.slug} to={`/gallery?category=${cat.slug}`} className="group relative overflow-hidden aspect-[4/3] bg-secondary">
              <img
                src={cat.image}
                alt={cat.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-foreground/30 group-hover:bg-foreground/50 transition-colors duration-300" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground">
                <h3 className="font-serif text-2xl md:text-3xl mb-1">{cat.title}</h3>
                <p className="text-xs uppercase tracking-widest opacity-80 font-sans">{cat.count} {worksLabel}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-6 pb-20 md:pb-28">
        <div className="flex items-end justify-between mb-10 md:mb-14">
          <SectionHeader title={featuredTitle} subtitle={featuredSub} className="mb-0" />
          <Link to="/gallery" className="hidden md:inline-flex text-sm text-accent hover:text-accent/80 transition-colors whitespace-nowrap">
            {viewAll} →
          </Link>
        </div>
        {featuredQuery.isLoading ? (
          <p className="text-muted-foreground">{loadingFeatured}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featured.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        )}
        <div className="md:hidden mt-8 text-center">
          <Link to="/gallery" className="text-sm text-accent">
            {viewAll} →
          </Link>
        </div>
      </section>

      <section className="bg-secondary/40 py-20 md:py-28">
        <div className="container mx-auto px-6">
          <SectionHeader title={artistsTitle} subtitle={artistsSub} />
          {artistsQuery.isLoading ? (
            <p className="text-muted-foreground">{loadingArtists}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-6 py-20 md:py-28">
        <div className="flex items-end justify-between mb-10 md:mb-14">
          <SectionHeader title={journalTitle} subtitle={journalSub} className="mb-0" />
          <Link to="/blog" className="hidden md:inline-flex text-sm text-accent hover:text-accent/80 transition-colors">
            {allArticles} →
          </Link>
        </div>
        {postsQuery.isLoading ? (
          <p className="text-muted-foreground">{loadingJournal}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {latestPosts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border">
        <div className="container mx-auto px-6 py-20 md:py-28 text-center max-w-2xl">
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">{privateViewing}</h2>
          <p className="text-muted-foreground mb-8">
            {privateViewingSub}
          </p>
          <Button asChild size="lg" className="uppercase tracking-wider text-xs">
            <Link to="/contact">{getInTouch}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
