import { useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { pickByLang } from "@/i18n/config";

const ContactPage = () => {
  const { t, lang } = useI18n();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setErrorText("");

    try {
      const fd = new FormData(e.target as HTMLFormElement);
      await api.post("/api/v1/contact", {
        name: fd.get("name"),
        email: fd.get("email"),
        subject: fd.get("subject") || pickByLang(lang, { en: "Message from website", cs: "Zpráva z webu" }),
        message: fd.get("message"),
      });
      setState("sent");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setState("error");
      setErrorText(err?.response?.data?.detail || pickByLang(lang, { en: "Unable to send message. Please try again.", cs: "Zprávu se nepodařilo odeslat. Zkuste to znovu." }));
    }
  };

  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 max-w-5xl">
            <div>
              <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-4">{t("contact.title")}</h1>
              <p className="text-muted-foreground mb-8">
                {t("contact.subtitle")}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input name="name" required placeholder={t("contact.formName")} className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                <input name="email" type="email" required placeholder={t("contact.formEmail")} className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                <input name="subject" required placeholder={t("contact.formSubject")} className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                <textarea name="message" rows={5} required placeholder={t("contact.formMessage")} className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
                <Button type="submit" className="uppercase tracking-wider text-xs" disabled={state === "sending"}>
                  {state === "sending" ? t("contact.sending") : t("contact.send")}
                </Button>
              </form>
              {state === "sent" && <p className="mt-4 text-sm text-green-700">{t("contact.success")}</p>}
              {state === "error" && <p className="mt-4 text-sm text-red-700">{errorText}</p>}
            </div>

            <div className="space-y-8 md:pt-20">
              <div>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-sans font-medium">{t("contact.address")}</h3>
                <div className="text-sm space-y-1">
                  <p>Dominikánské náměstí 656/2</p>
                  <p>Jalta palác</p>
                  <p>Brno</p>
                  <p>Czech Republic</p>
                </div>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-sans font-medium">{t("contact.contactInfo")}</h3>
                <div className="text-sm space-y-1">
                  <p>Jméno: Rostislav Blaha</p>
                  <p>info@kunstkabinett.cz</p>
                  <p>Telefon: +420 775 635 333</p>
                </div>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-sans font-medium">{pickByLang(lang, { en: "Hours", cs: "Otevírací doba" })}</h3>
                <div className="text-sm space-y-1">
                  <p>{pickByLang(lang, { en: "Tuesday-Saturday: 11:00-18:00", cs: "Úterý-Sobota: 11:00-18:00" })}</p>
                  <p>{pickByLang(lang, { en: "Sunday-Monday: By appointment", cs: "Neděle-Pondělí: po domluvě" })}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="aspect-[4/3] border border-border overflow-hidden">
                  <iframe
                    title="Kunstkabinett map"
                    src="https://www.google.com/maps?q=Dominik%C3%A1nsk%C3%A9+n%C3%A1m%C4%9Bst%C3%AD+656%2F2%2C+Brno&output=embed"
                    className="w-full h-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href="https://maps.app.goo.gl/XMWcPrXx3abgJpzMA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:text-accent/80 transition-colors"
                >
                  {t("contact.location")} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ContactPage;
