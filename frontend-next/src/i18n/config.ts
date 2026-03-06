export const SUPPORTED_LANGUAGES = [
  { code: "cs", label: "CS" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "ru", label: "RU" },
  { code: "zh", label: "ZH" },
  { code: "ja", label: "JA" },
  { code: "it", label: "IT" },
  { code: "pl", label: "PL" },
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number]["code"];

type LocaleMap = Record<SupportedLang, string>;

const DATE_LOCALES: LocaleMap = {
  cs: "cs-CZ",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  ru: "ru-RU",
  zh: "zh-CN",
  ja: "ja-JP",
  it: "it-IT",
  pl: "pl-PL",
};

export function getLocaleForLang(lang?: string): string {
  if (!lang) return DATE_LOCALES.en;
  return DATE_LOCALES[(lang as SupportedLang) || "en"] || DATE_LOCALES.en;
}

export function pickByLang<T>(lang: string | undefined, values: Partial<Record<SupportedLang, T>> & { en: T }): T {
  const key = (lang || "en") as SupportedLang;
  return values[key] ?? values.en;
}
