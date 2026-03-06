import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import ArtworkCard from "@/components/ArtworkCard";
import { fetchArtworkBySlug, fetchArtworksByArtist, fetchArtworksByCategory } from "@/data/artworks";
import api from "@/lib/api";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { getLocaleForLang, pickByLang } from "@/i18n/config";
import { useCart } from "@/modules/common/CartContext";

const ArtworkDetailPage = () => {
  const { t, lang } = useI18n();
  const { add } = useCart() as any;
  const locale = getLocaleForLang(lang);
  const { slug = "" } = useParams<{ slug: string }>();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryState, setInquiryState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const artworkQuery = useQuery({
    queryKey: ["artworks", slug, lang],
    queryFn: () => fetchArtworkBySlug(slug, lang),
    enabled: !!slug,
  });

  const artwork = artworkQuery.data;

  const artistWorksQuery = useQuery({
    queryKey: ["artworks", "artist", artwork?.artistSlug, lang],
    queryFn: () => fetchArtworksByArtist(artwork?.artistSlug || "", lang),
    enabled: !!artwork?.artistSlug,
  });

  const relatedByCategoryQuery = useQuery({
    queryKey: ["artworks", "category", artwork?.category, lang],
    queryFn: () => fetchArtworksByCategory(artwork?.category || "painting", lang),
    enabled: !!artwork?.category,
  });

  const moreByArtist = useMemo(
    () => (artistWorksQuery.data || []).filter((a) => a.id !== artwork?.id).slice(0, 4),
    [artistWorksQuery.data, artwork?.id],
  );

  const related = useMemo(
    () =>
      (relatedByCategoryQuery.data || [])
        .filter((a) => a.id !== artwork?.id && a.artistSlug !== artwork?.artistSlug)
        .slice(0, 4),
    [relatedByCategoryQuery.data, artwork?.id, artwork?.artistSlug],
  );

  if (artworkQuery.isLoading) {
    return (
      <Layout>
        <div className="pt-32 container mx-auto px-6 py-20 text-muted-foreground">{pickByLang(lang, { en: "Loading artwork...", cs: "Načítám dílo..." })}</div>
      </Layout>
    );
  }

  if (!artwork) {
    return (
      <Layout>
        <div className="pt-32 container mx-auto px-6 text-center py-20">
          <h1 className="font-serif text-3xl mb-4">Artwork not found</h1>
          <Link to="/gallery" className="text-accent">
            ← {pickByLang(lang, { en: "Back to Gallery", cs: "Zpět do galerie" })}
          </Link>
        </div>
      </Layout>
    );
  }

  const availabilityColors = {
    available: "bg-accent text-accent-foreground",
    reserved: "bg-secondary text-secondary-foreground",
    sold: "bg-muted text-muted-foreground",
  };

  const getAvailabilityLabel = (availability: "available" | "reserved" | "sold") => {
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

  const specs = [
    {
      label: pickByLang(lang, { cs: "Kategorie", en: "Category", fr: "Catégorie", de: "Kategorie", ru: "Категория", zh: "类别", ja: "カテゴリー", it: "Categoria", pl: "Kategoria" }),
      value:
        artwork.category === "painting"
          ? pickByLang(lang, { cs: "Obrazy", en: "Paintings", fr: "Peintures", de: "Gemälde", ru: "Картины", zh: "绘画", ja: "絵画", it: "Dipinti", pl: "Obrazy" })
          : artwork.category === "sculpture"
            ? pickByLang(lang, { cs: "Sochy", en: "Sculptures", fr: "Sculptures", de: "Skulpturen", ru: "Скульптуры", zh: "雕塑", ja: "彫刻", it: "Sculture", pl: "Rzeźby" })
            : pickByLang(lang, { cs: "Grafiky", en: "Graphics", fr: "Graphiques", de: "Grafiken", ru: "Графика", zh: "版画", ja: "グラフィック", it: "Grafiche", pl: "Grafiki" }),
    },
    { label: pickByLang(lang, { cs: "Rok", en: "Year", fr: "Année", de: "Jahr", ru: "Год", zh: "年份", ja: "年", it: "Anno", pl: "Rok" }), value: artwork.year },
    {
      label: pickByLang(lang, { cs: "Technika", en: "Technique", fr: "Technique", de: "Technik", ru: "Техника", zh: "技法", ja: "技法", it: "Tecnica", pl: "Technika" }),
      value:
        String(artwork.technique || "").trim().toLowerCase() === "mixed media"
          ? pickByLang(lang, { cs: "Kombinovaná technika", en: "Mixed media", fr: "Technique mixte", de: "Mischtechnik", ru: "Смешанная техника", zh: "综合材料", ja: "ミクストメディア", it: "Tecnica mista", pl: "Technika mieszana" })
          : artwork.technique,
    },
    {
      label: pickByLang(lang, { cs: "Materiály", en: "Materials", fr: "Matériaux", de: "Materialien", ru: "Материалы", zh: "材料", ja: "素材", it: "Materiali", pl: "Materiały" }),
      value:
        String(artwork.materials || "").trim().toLowerCase() === "on request"
          ? pickByLang(lang, { cs: "Na vyžádání", en: "On request", fr: "Sur demande", de: "Auf Anfrage", ru: "По запросу", zh: "按需提供", ja: "お問い合わせ", it: "Su richiesta", pl: "Na zapytanie" })
          : artwork.materials,
    },
    {
      label: pickByLang(lang, { cs: "Rozměry", en: "Dimensions", fr: "Dimensions", de: "Maße", ru: "Размеры", zh: "尺寸", ja: "寸法", it: "Dimensioni", pl: "Wymiary" }),
      value:
        String(artwork.dimensions || "").trim().toLowerCase() === "on request"
          ? pickByLang(lang, { cs: "Na vyžádání", en: "On request", fr: "Sur demande", de: "Auf Anfrage", ru: "По запросу", zh: "按需提供", ja: "お問い合わせ", it: "Su richiesta", pl: "Na zapytanie" })
          : artwork.dimensions,
    },
  ];

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryState("sending");
    try {
      const fd = new FormData(e.target as HTMLFormElement);
      await api.post("/api/v1/contact", {
        name: fd.get("name"),
        email: fd.get("email"),
        subject: `${pickByLang(lang, { en: "Inquiry", cs: "Dotaz" })}: ${artwork.title}`,
        message: fd.get("message"),
      });
      setInquiryState("sent");
      setTimeout(() => {
        setInquiryOpen(false);
        setInquiryState("idle");
      }, 1200);
    } catch {
      setInquiryState("error");
    }
  };

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <Link to="/gallery" className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block">
            ← {pickByLang(lang, { en: "Back to Gallery", cs: "Zpět do galerie" })}
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <div>
              <div className="h-[52vh] sm:h-[60vh] lg:h-[70vh] max-h-[780px] bg-secondary/50 overflow-hidden cursor-zoom-in" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}>
                <img src={artwork.images[0]} alt={artwork.title} className="w-full h-full object-contain" />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-2">{artwork.title}</h1>
                <Link to={`/artists/${artwork.artistSlug}`} className="text-muted-foreground hover:text-accent transition-colors text-sm">
                  {artwork.artistName}
                </Link>
              </div>

              <div className="flex items-center gap-4">
                {artwork.availability !== "sold" ? (
                  <span className="text-2xl font-medium text-foreground">
                    {artwork.price.toLocaleString(locale)} {artwork.currency}
                  </span>
                ) : (
                  <span className="text-lg text-muted-foreground">{getAvailabilityLabel("sold")}</span>
                )}
                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-sans font-medium rounded-sm ${availabilityColors[artwork.availability]}`}>
                  {getAvailabilityLabel(artwork.availability)}
                </span>
              </div>

              <div className="border-t border-border pt-6">
                <table className="w-full text-sm">
                  <tbody>
                    {specs.map((s) => (
                      <tr key={s.label} className="border-b border-border last:border-0">
                        <td className="py-2.5 text-muted-foreground w-32">{s.label}</td>
                        <td className="py-2.5 text-foreground capitalize">{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-border pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">{artwork.description}</p>
              </div>

              <div className="flex gap-3 pt-4">
                {artwork.availability === "available" && (
                  <Button
                    onClick={() =>
                      add(
                        {
                          id: artwork.id,
                          title: artwork.title,
                          price: artwork.price,
                          image_url: artwork.images?.[0] || null,
                          artist_name: artwork.artistName,
                          artist_slug: artwork.artistSlug,
                          available_stock: 1,
                        },
                        1,
                      )
                    }
                    className="uppercase tracking-wider text-xs flex-1"
                  >
                    {t("productDetail.addToCart")}
                  </Button>
                )}
                <Button onClick={() => setInquiryOpen(true)} className="uppercase tracking-wider text-xs flex-1">
                  {pickByLang(lang, { en: "Send Inquiry", cs: "Poslat dotaz" })}
                </Button>
              </div>
            </div>
          </div>

          {moreByArtist.length > 0 && (
            <section className="mt-20 md:mt-28">
              <h3 className="font-serif text-2xl mb-8">{pickByLang(lang, { en: "More by", cs: "Další od" })} {artwork.artistName}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {moreByArtist.map((a) => (
                  <ArtworkCard key={a.id} artwork={a} />
                ))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-20 md:mt-28">
              <h3 className="font-serif text-2xl mb-8">{pickByLang(lang, { en: "Related Works", cs: "Podobná díla" })}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {related.map((a) => (
                  <ArtworkCard key={a.id} artwork={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-6 right-6 text-primary-foreground" onClick={() => setLightboxOpen(false)}>
            <X className="w-6 h-6" />
          </button>
          {artwork.images.length > 1 && (
            <>
              <button
                className="absolute left-6 text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev - 1 + artwork.images.length) % artwork.images.length);
                }}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                className="absolute right-6 text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev + 1) % artwork.images.length);
                }}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          <img
            src={artwork.images[lightboxIndex]}
            alt={artwork.title}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {inquiryOpen && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-6" onClick={() => setInquiryOpen(false)}>
          <div className="bg-background w-full max-w-md p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-4 right-4" onClick={() => setInquiryOpen(false)}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-2xl mb-2">{pickByLang(lang, { en: "Send Inquiry", cs: "Poslat dotaz" })}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {pickByLang(lang, { en: "Regarding", cs: "K dílu" })}: <span className="text-foreground">{artwork.title}</span>
            </p>
            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <input name="name" required placeholder={pickByLang(lang, { en: "Your name", cs: "Vaše jméno" })} className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent" />
              <input name="email" type="email" required placeholder={t("contact.formEmail")} className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent" />
              <textarea name="message" rows={4} required placeholder={t("contact.formMessage")} className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
              <Button type="submit" className="w-full uppercase tracking-wider text-xs" disabled={inquiryState === "sending"}>
                {inquiryState === "sending"
                  ? pickByLang(lang, { en: "Sending...", cs: "Odesílám..." })
                  : inquiryState === "sent"
                    ? pickByLang(lang, { en: "Sent", cs: "Odesláno" })
                    : pickByLang(lang, { en: "Send", cs: "Odeslat" })}
              </Button>
              {inquiryState === "error" && <p className="text-xs text-red-600">{pickByLang(lang, { en: "Unable to send inquiry. Please try again.", cs: "Dotaz se nepodařilo odeslat. Zkuste to znovu." })}</p>}
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ArtworkDetailPage;
