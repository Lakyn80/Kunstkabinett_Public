import { Link } from "react-router-dom";
import { type Artist } from "@/data/artists";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

interface ArtistCardProps {
  artist: Artist;
}

const ArtistCard = ({ artist }: ArtistCardProps) => {
  const { lang } = useI18n();
  const workCount = artist.productsCount ?? 0;
  const portrait =
    artist.portrait ||
    "/placeholder.svg";
  const worksLabel = pickByLang(lang, {
    en: "Works",
    cs: "děl",
    fr: "oeuvres",
    de: "Werke",
    ru: "работ",
    zh: "件作品",
    ja: "作品",
    it: "opere",
    pl: "dzieł",
  });

  return (
    <Link to={`/artists/${artist.slug}`} className="group block">
      <div className="relative overflow-hidden aspect-square bg-secondary/50">
        <img
          src={portrait}
          alt={artist.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="mt-4 space-y-1">
        <h3 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors duration-200">
          {artist.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{artist.bioShort}</p>
        <p className="text-xs text-muted-foreground">
          {workCount} {worksLabel}
        </p>
      </div>
    </Link>
  );
};

export default ArtistCard;
