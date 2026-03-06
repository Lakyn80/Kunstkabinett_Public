import Layout from "@/components/Layout";
import { useI18n } from "@/i18n/I18nProvider";

const PrivacyPage = () => {
  const { t } = useI18n();

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl">
            <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-8">{t("legal.privacy.title")}</h1>
            <article className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {t("legal.privacy.content")}
            </article>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPage;
