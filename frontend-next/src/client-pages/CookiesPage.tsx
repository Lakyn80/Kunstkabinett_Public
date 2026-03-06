import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useI18n } from "@/i18n/I18nProvider";
import { useLocation } from "react-router-dom";

type CookieSelection = {
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
};

const STORAGE_KEY = "kk_cookie_settings";

const CookiesPage = () => {
  const { t } = useI18n();
  const location = useLocation();
  const [saved, setSaved] = useState(false);
  const [selection, setSelection] = useState<CookieSelection>({
    preferences: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSelection({
        preferences: !!parsed?.preferences,
        analytics: !!parsed?.analytics,
        marketing: !!parsed?.marketing,
      });
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== "/cookie-settings") return;
    const node = document.getElementById("settings");
    if (!node) return;
    node.scrollIntoView({ behavior: "auto", block: "start" });
  }, [location.pathname]);

  const persist = (value: CookieSelection) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setSaved(true);
  };

  const onAcceptAll = () => {
    const next = { preferences: true, analytics: true, marketing: true };
    setSelection(next);
    persist(next);
  };

  const onRejectOptional = () => {
    const next = { preferences: false, analytics: false, marketing: false };
    setSelection(next);
    persist(next);
  };

  const onSave = () => {
    persist(selection);
  };

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl space-y-10">
            <div>
              <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-8">{t("legal.cookies.title")}</h1>
              <article className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {t("legal.cookies.content")}
              </article>
            </div>

            <section id="settings" className="border border-border bg-secondary/20 p-6 md:p-8 rounded-sm">
              <h2 className="font-serif text-2xl text-foreground mb-3">{t("footer.cookieSettings")}</h2>
              <p className="text-sm text-muted-foreground mb-6">{t("cookies.description")}</p>

              <div className="space-y-5">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked readOnly className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t("cookies.necessary.title")}</span>
                    <span className="block text-sm text-muted-foreground">{t("cookies.necessary.description")}</span>
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selection.preferences}
                    onChange={(e) => setSelection((prev) => ({ ...prev, preferences: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t("cookies.preferences.title")}</span>
                    <span className="block text-sm text-muted-foreground">{t("cookies.preferences.description")}</span>
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selection.analytics}
                    onChange={(e) => setSelection((prev) => ({ ...prev, analytics: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t("cookies.analytics.title")}</span>
                    <span className="block text-sm text-muted-foreground">{t("cookies.analytics.description")}</span>
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selection.marketing}
                    onChange={(e) => setSelection((prev) => ({ ...prev, marketing: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t("cookies.marketing.title")}</span>
                    <span className="block text-sm text-muted-foreground">{t("cookies.marketing.description")}</span>
                  </span>
                </label>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onAcceptAll}
                  className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider rounded-sm hover:opacity-90 transition-opacity"
                >
                  {t("cookies.acceptAll")}
                </button>
                <button
                  type="button"
                  onClick={onRejectOptional}
                  className="border border-border px-4 py-2 text-xs uppercase tracking-wider rounded-sm hover:bg-secondary transition-colors"
                >
                  {t("cookies.rejectOptional")}
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className="border border-border px-4 py-2 text-xs uppercase tracking-wider rounded-sm hover:bg-secondary transition-colors"
                >
                  {t("cookies.save")}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CookiesPage;
