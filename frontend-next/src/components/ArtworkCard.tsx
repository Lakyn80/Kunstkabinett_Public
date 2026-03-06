import { Link } from "react-router-dom";
import { type Artwork } from "@/data/artworks";
import { useI18n } from "@/i18n/I18nProvider";
import { getLocaleForLang, pickByLang } from "@/i18n/config";

interface ArtworkCardProps {
  artwork: Artwork;
}

const ArtworkCard = ({ artwork }: ArtworkCardProps) => {
  const { t, lang } = useI18n();
  const mainImage = artwork.images?.[0] || "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=1000&fit=crop";
  const hoverImage = artwork.images?.[1] || null;
  const locale = getLocaleForLang(lang);

  const availabilityColors = {
    available: "bg-accent text-accent-foreground",
    reserved: "bg-secondary text-secondary-foreground",
    sold: "bg-muted text-muted-foreground",
  };

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

  return (
    <Link
      to={`/gallery/${artwork.slug}`}
      className="group block"
    >
      <div className="relative overflow-hidden bg-secondary/50 aspect-[3/4]">
        <img
          src={mainImage}
          alt={artwork.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {hoverImage && (
          <img
            src={hoverImage}
            alt={artwork.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          />
        )}
        <span
          className={`absolute top-3 right-3 px-2 py-0.5 text-[10px] uppercase tracking-widest font-sans font-medium rounded-sm ${availabilityColors[artwork.availability]}`}
        >
          {getAvailabilityLabel(artwork.availability)}
        </span>
      </div>
      <div className="mt-4 space-y-1">
        <h3 className="font-serif text-base text-foreground group-hover:text-accent transition-colors duration-200">
          {artwork.title}
        </h3>
        <p className="text-xs text-muted-foreground tracking-wide">{artwork.artistName}</p>
        {artwork.availability !== "sold" && (
          <p className="text-sm text-foreground font-medium">
            {artwork.price.toLocaleString(locale)} {artwork.currency}
          </p>
        )}
      </div>
    </Link>
  );
};

export default ArtworkCard;
