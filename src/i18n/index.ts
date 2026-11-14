import { ru } from "./ru";
import { en } from "./en";
import type { Locale } from "./ru";

export type { Locale };
export type Messages = typeof ru;

export const messages: Record<Locale, Messages> = { ru, en };

export function localeFromBuild(): Locale {
  if (typeof window !== "undefined") {
    const el = document.documentElement;
    const lang = el.getAttribute("lang");
    if (lang === "en") return "en";
  }
  return "ru";
}

export function reviewWord(n: number, t: Messages): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return t.reviews.one(n);
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return t.reviews.few(n);
  return t.reviews.many(n);
}
