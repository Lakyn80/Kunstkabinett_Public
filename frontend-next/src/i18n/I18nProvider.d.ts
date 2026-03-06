import type { ReactNode } from "react";

export interface I18nContextValue {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

export function I18nProvider(props: { children: ReactNode }): JSX.Element;
export function useI18n(): I18nContextValue;
