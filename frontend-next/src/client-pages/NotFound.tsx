import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

const NotFound = () => {
  const { lang } = useI18n();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{pickByLang(lang, { en: "Oops! Page not found", cs: "Jejda, stránka nebyla nalezena" })}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {pickByLang(lang, { en: "Return to Home", cs: "Zpět na domovskou stránku" })}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
