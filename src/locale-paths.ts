import type { Locale } from "./i18n";

export const LANG_COOKIE = "lang";
export const DEFAULT_LANG: Locale = "en";

export function pagePath(slug: string, locale: Locale, defaultCity: string): string {
  const isDefault = slug === defaultCity;
  if (locale === "en") return isDefault ? "/" : `/${slug}/`;
  return isDefault ? "/ru/" : `/ru/${slug}/`;
}

export function persistLangCookie(locale: Locale) {
  try {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `${LANG_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
}
