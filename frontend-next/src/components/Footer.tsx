import { Link } from "react-router-dom";
import { Instagram, Mail } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

const Footer = () => {
  const { t, lang } = useI18n();
  const brandText = pickByLang(lang, {
    en: "Contemporary art gallery in Brno. Original paintings, sculptures, and graphic works by Czech and international artists.",
    cs: "Galerie současného umění v Brně. Originální obrazy, sochy a grafiky českých i zahraničních umělců.",
    fr: "Galerie d'art contemporain à Brno. Peintures, sculptures et oeuvres graphiques originales d'artistes tchèques et internationaux.",
    de: "Galerie für zeitgenössische Kunst in Brünn. Originale Gemälde, Skulpturen und Grafiken von tschechischen und internationalen Künstlern.",
    ru: "Галерея современного искусства в Брно. Оригинальные картины, скульптуры и графические работы чешских и зарубежных художников.",
    zh: "布尔诺当代艺术画廊。汇集捷克及国际艺术家的原创绘画、雕塑与版画作品。",
    ja: "ブルノの現代アートギャラリー。チェコおよび海外アーティストによるオリジナルの絵画、彫刻、グラフィック作品を紹介します。",
    it: "Galleria d'arte contemporanea a Brno. Dipinti, sculture e opere grafiche originali di artisti cechi e internazionali.",
    pl: "Galeria sztuki współczesnej w Brnie. Oryginalne obrazy, rzeźby i grafiki artystów czeskich i międzynarodowych.",
  });
  const newsletterTitle = pickByLang(lang, {
    en: "Newsletter",
    cs: "Newsletter",
    fr: "Newsletter",
    de: "Newsletter",
    ru: "Рассылка",
    zh: "订阅通讯",
    ja: "ニュースレター",
    it: "Newsletter",
    pl: "Newsletter",
  });
  const newsletterText = pickByLang(lang, {
    en: "Receive updates on new works, exhibitions, and events.",
    cs: "Získejte novinky o nových dílech, výstavách a akcích.",
    fr: "Recevez des nouvelles sur les nouvelles oeuvres, expositions et événements.",
    de: "Erhalten Sie Neuigkeiten zu neuen Werken, Ausstellungen und Veranstaltungen.",
    ru: "Получайте новости о новых работах, выставках и событиях.",
    zh: "接收有关新作品、展览与活动的最新资讯。",
    ja: "新作、展示、イベント情報をお届けします。",
    it: "Ricevi aggiornamenti su nuove opere, mostre ed eventi.",
    pl: "Otrzymuj informacje o nowych dziełach, wystawach i wydarzeniach.",
  });
  const allWorks = pickByLang(lang, {
    en: "All Works",
    cs: "Všechna díla",
    fr: "Toutes les oeuvres",
    de: "Alle Werke",
    ru: "Все работы",
    zh: "全部作品",
    ja: "すべての作品",
    it: "Tutte le opere",
    pl: "Wszystkie dzieła",
  });
  const paintings = pickByLang(lang, {
    en: "Paintings",
    cs: "Obrazy",
    fr: "Peintures",
    de: "Gemälde",
    ru: "Картины",
    zh: "绘画",
    ja: "絵画",
    it: "Dipinti",
    pl: "Obrazy",
  });
  const sculptures = pickByLang(lang, {
    en: "Sculptures",
    cs: "Sochy",
    fr: "Sculptures",
    de: "Skulpturen",
    ru: "Скульптуры",
    zh: "雕塑",
    ja: "彫刻",
    it: "Sculture",
    pl: "Rzeźby",
  });
  const graphics = pickByLang(lang, {
    en: "Graphics",
    cs: "Grafiky",
    fr: "Graphiques",
    de: "Grafiken",
    ru: "Графика",
    zh: "版画",
    ja: "グラフィック",
    it: "Grafiche",
    pl: "Grafiki",
  });
  const information = pickByLang(lang, {
    en: "Information",
    cs: "Informace",
    fr: "Informations",
    de: "Informationen",
    ru: "Информация",
    zh: "信息",
    ja: "情報",
    it: "Informazioni",
    pl: "Informacje",
  });
  const about = pickByLang(lang, {
    en: "About",
    cs: "O nás",
    fr: "À propos",
    de: "Über uns",
    ru: "О нас",
    zh: "关于我们",
    ja: "私たちについて",
    it: "Chi siamo",
    pl: "O nas",
  });
  const join = pickByLang(lang, {
    en: "Join",
    cs: "Přihlásit",
    fr: "S'inscrire",
    de: "Anmelden",
    ru: "Подписаться",
    zh: "加入",
    ja: "登録",
    it: "Iscriviti",
    pl: "Dołącz",
  });
  const emailPlaceholder = pickByLang(lang, {
    en: "your@email.com",
    cs: "vas@email.com",
    fr: "votre@email.com",
    de: "ihre@email.com",
    ru: "vash@email.com",
    zh: "your@email.com",
    ja: "your@email.com",
    it: "tuo@email.com",
    pl: "twoj@email.com",
  });
  const terms = t("footer.terms");
  const privacy = t("footer.privacy");
  const cookies = t("footer.cookies");
  const cookieSettings = t("footer.cookieSettings");

  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="font-serif text-2xl tracking-tight text-foreground">
              Kunstkabinett
            </Link>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {brandText}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-sans font-medium">
              {t("products.title")}
            </h4>
            <div className="flex flex-col gap-2">
              <Link to="/gallery" className="text-sm text-foreground hover:text-accent transition-colors">{allWorks}</Link>
              <Link to="/gallery?category=painting" className="text-sm text-foreground hover:text-accent transition-colors">{paintings}</Link>
              <Link to="/gallery?category=sculpture" className="text-sm text-foreground hover:text-accent transition-colors">{sculptures}</Link>
              <Link to="/gallery?category=graphic" className="text-sm text-foreground hover:text-accent transition-colors">{graphics}</Link>
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-sans font-medium">
              {information}
            </h4>
            <div className="flex flex-col gap-2">
              <Link to="/artists" className="text-sm text-foreground hover:text-accent transition-colors">{t("nav.artists")}</Link>
              <Link to="/blog" className="text-sm text-foreground hover:text-accent transition-colors">{t("nav.blog")}</Link>
              <Link to="/about" className="text-sm text-foreground hover:text-accent transition-colors">{about}</Link>
              <Link to="/contact" className="text-sm text-foreground hover:text-accent transition-colors">{t("nav.contact")}</Link>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-sans font-medium">
              {newsletterTitle}
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              {newsletterText}
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder={emailPlaceholder}
                className="flex-1 bg-background border border-border px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider rounded-sm hover:bg-primary/90 transition-colors">
                {join}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Instagram">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Email">
              <Mail className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Kunstkabinett</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">{terms}</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">{privacy}</Link>
            <Link to="/cookies" className="hover:text-foreground transition-colors">{cookies}</Link>
            <Link to="/cookie-settings" className="hover:text-foreground transition-colors">{cookieSettings}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
