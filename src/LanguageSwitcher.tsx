import { useGrokTheme } from "./ui";
import type { Locale } from "./i18n";
import { pagePath, persistLangCookie } from "./locale-paths";
import siteConfig from "./site-config.json";
import buildMeta from "./build-meta.json";

const HINT_KEY = "travel-lang-hint-dismissed";

export function pathForCity(slug: string, locale: Locale, defaultCity: string) {
  return pagePath(slug, locale, defaultCity);
}

export function persistLocale(locale: Locale) {
  persistLangCookie(locale);
}

export function LanguageSwitcher({ t }: { t: { lang: { switcher: string; ru: string; en: string } } }) {
  const theme = useGrokTheme();
  const cfg = siteConfig as { defaultCity: string };
  const meta = buildMeta as { currentSlug: string; locale: Locale };

  const go = (locale: Locale) => {
    if (locale === meta.locale) return;
    persistLocale(locale);
    window.location.href = pathForCity(meta.currentSlug, locale, cfg.defaultCity);
  };

  return (
    <>
      <div className="lang-switcher lang-switcher-desktop" role="group" aria-label={t.lang.switcher}>
        <a
          href={pathForCity(meta.currentSlug, "ru", cfg.defaultCity)}
          onClick={(e) => {
            e.preventDefault();
            go("ru");
          }}
          className={meta.locale === "ru" ? "lang-seg active" : "lang-seg"}
          aria-current={meta.locale === "ru" ? "true" : undefined}
          style={{
            textDecoration: "none",
            color: meta.locale === "ru" ? theme.text.primary : theme.text.secondary,
            fontWeight: meta.locale === "ru" ? theme.weight.semibold : theme.weight.medium,
          }}
        >
          {t.lang.ru}
        </a>
        <a
          href={pathForCity(meta.currentSlug, "en", cfg.defaultCity)}
          onClick={(e) => {
            e.preventDefault();
            go("en");
          }}
          className={meta.locale === "en" ? "lang-seg active" : "lang-seg"}
          aria-current={meta.locale === "en" ? "true" : undefined}
          style={{
            textDecoration: "none",
            color: meta.locale === "en" ? theme.text.primary : theme.text.secondary,
            fontWeight: meta.locale === "en" ? theme.weight.semibold : theme.weight.medium,
          }}
        >
          {t.lang.en}
        </a>
      </div>
      <label className="lang-switcher-mobile field">
        <span className="sr-only">{t.lang.switcher}</span>
        <select
          value={meta.locale}
          onChange={(e) => go(e.target.value as Locale)}
          aria-label={t.lang.switcher}
        >
          <option value="ru">{t.lang.ru}</option>
          <option value="en">{t.lang.en}</option>
        </select>
      </label>
    </>
  );
}

export function EnglishHintBanner({
  t,
  visible,
  onDismiss,
}: {
  t: { lang: { hint: string; dismiss: string } };
  visible: boolean;
  onDismiss: () => void;
}) {
  const theme = useGrokTheme();
  const cfg = siteConfig as { defaultCity: string };
  const meta = buildMeta as { currentSlug: string; locale: Locale };

  const isRoot = (buildMeta as { isRootPage?: boolean }).isRootPage;
  if (!visible || meta.locale !== "ru" || !isRoot) return null;

  const onGo = () => {
    persistLocale("en");
    window.location.href = pathForCity(meta.currentSlug, "en", cfg.defaultCity);
  };

  return (
    <div
      className="lang-hint"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 14px",
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.border.default}`,
        background: theme.fill.accentSubtle,
        marginBottom: 8,
      }}
    >
      <button
        type="button"
        onClick={onGo}
        style={{
          border: 0,
          background: "none",
          padding: 0,
          color: theme.text.accent,
          fontWeight: theme.weight.semibold,
          cursor: "pointer",
          fontFamily: theme.font.family,
        }}
      >
        {t.lang.hint}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t.lang.dismiss}
        style={{
          marginLeft: "auto",
          border: `1px solid ${theme.border.default}`,
          background: theme.bg.elevated,
          borderRadius: theme.radius.md,
          padding: "4px 10px",
          cursor: "pointer",
          fontFamily: theme.font.family,
          fontSize: theme.font.caption.fontSize,
        }}
      >
        {t.lang.dismiss}
      </button>
    </div>
  );
}

export function shouldShowEnglishHint(): boolean {
  try {
    if (/(?:^|; )lang=(en|ru)(?:;|$)/.test(document.cookie)) return false;
    if (localStorage.getItem(HINT_KEY)) return false;
    const lang = navigator.language || "";
    return !lang.toLowerCase().startsWith("ru");
  } catch {
    return false;
  }
}

export function dismissEnglishHint() {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}
