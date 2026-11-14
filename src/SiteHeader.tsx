import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Locale, Messages } from "./i18n";
import { LanguageSwitcher, pathForCity } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ReloadButton } from "./ReloadButton";
import { useGrokTheme } from "./ui";
import siteConfig from "./site-config.json";
import buildMeta from "./build-meta.json";

const COLLAPSE_KEY = "travel-top-nav-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function NavChevron({ down }: { down: boolean }) {
  const theme = useGrokTheme();
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={down ? "M6 10l6 6 6-6" : "M6 14l6-6 6 6"}
        stroke={theme.text.primary}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseButton({
  collapsed,
  t,
  onClick,
  variant,
  style,
}: {
  collapsed: boolean;
  t: Messages;
  onClick: () => void;
  variant: "bar" | "fab";
  style: CSSProperties;
}) {
  return (
    <button
      type="button"
      className={`top-nav-toggle top-nav-toggle--${variant}`}
      data-testid={collapsed ? "top-nav-fab" : "top-nav-collapse"}
      aria-label={collapsed ? t.nav.expand : t.nav.collapse}
      aria-expanded={!collapsed}
      onClick={onClick}
      style={style}
    >
      <NavChevron down={collapsed} />
    </button>
  );
}

function HeaderCitySwitcher({ t, locale }: { t: Messages; locale: Locale }) {
  const theme = useGrokTheme();
  const cfg = siteConfig as {
    defaultCity: string;
    cities: { slug: string; title: string; title_en?: string; dates: string; count?: number }[];
  };
  const meta = buildMeta as { currentSlug: string };

  const cityTitle = (c: (typeof cfg.cities)[0]) =>
    locale === "en" ? c.title_en || c.title : c.title;

  const options = cfg.cities.map((c) => ({
    value: c.slug,
    label: cityTitle(c),
  }));

  const onNavigate = (slug: string) => {
    if (slug !== meta.currentSlug) {
      window.location.href = pathForCity(slug, locale, cfg.defaultCity);
    }
  };

  return (
    <div className="city-switcher top-nav-city">
      <div className="city-switcher-desktop segmented" role="tablist" aria-label={t.city.switcher}>
        {cfg.cities.map((c) => {
          const active = c.slug === meta.currentSlug;
          return (
            <a
              key={c.slug}
              href={pathForCity(c.slug, locale, cfg.defaultCity)}
              className={active ? "segment active" : "segment"}
              role="tab"
              aria-selected={active}
              style={{
                textDecoration: "none",
                color: active ? theme.text.primary : theme.text.secondary,
              }}
            >
              <span className="city-seg-label">{cityTitle(c)}</span>
              {c.count != null ? <span className="seg-count">{c.count}</span> : null}
            </a>
          );
        })}
      </div>
      <div className="city-switcher-mobile top-nav-mobile-row">
        <label className="field top-nav-field">
          <span className="sr-only">{t.city.switcher}</span>
          <select
            value={meta.currentSlug}
            onChange={(e) => onNavigate(e.target.value)}
            aria-label={t.city.switcher}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export function SiteHeader({ t, locale }: { t: Messages; locale: Locale }) {
  const theme = useGrokTheme();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const barRef = useRef<HTMLElement>(null);

  const setCollapsedState = (next: boolean) => {
    setCollapsed(next);
    persistCollapsed(next);
  };

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("top-nav-collapsed", collapsed);
  }, [collapsed]);

  useEffect(() => {
    const root = document.documentElement;
    const updateHeight = () => {
      if (collapsed) {
        root.style.setProperty("--top-nav-offset", "0px");
        return;
      }
      const h = barRef.current?.offsetHeight ?? 56;
      root.style.setProperty("--top-nav-offset", `calc(${h}px + env(safe-area-inset-top, 0px))`);
    };
    updateHeight();
    const ro = barRef.current ? new ResizeObserver(updateHeight) : null;
    if (barRef.current && ro) ro.observe(barRef.current);
    window.addEventListener("resize", updateHeight);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [collapsed]);

  const barControlStyle = {
    border: `1px solid ${theme.border.default}`,
    background: theme.bg.elevated,
    color: theme.text.primary,
  };
  const fabStyle = {
    ...barControlStyle,
    boxShadow: theme.kind === "dark" ? "0 4px 16px rgba(0,0,0,0.45)" : "0 4px 16px rgba(0,0,0,0.12)",
  };

  const onToggle = () => setCollapsedState(!collapsed);

  return (
    <>
      {!collapsed ? (
        <header
          ref={barRef}
          className="top-nav-bar"
          data-testid="top-nav-bar"
          style={{
            borderBottom: `1px solid ${theme.border.default}`,
          }}
        >
          <div className="top-nav-inner">
            <HeaderCitySwitcher t={t} locale={locale} />
            <div className="top-nav-controls">
              <ReloadButton t={t} />
              <ThemeSwitcher t={t} />
              <div className="top-nav-lang">
                <LanguageSwitcher t={t} />
              </div>
              <CollapseButton
                collapsed={false}
                t={t}
                onClick={onToggle}
                variant="bar"
                style={barControlStyle}
              />
            </div>
          </div>
        </header>
      ) : (
        <CollapseButton collapsed t={t} onClick={onToggle} variant="fab" style={fabStyle} />
      )}
    </>
  );
}

/** Expose for headless tests */
export function resetTopNavForTest(collapsed: boolean) {
  persistCollapsed(collapsed);
  const root = document.documentElement;
  root.classList.toggle("top-nav-collapsed", collapsed);
  root.style.setProperty("--top-nav-offset", collapsed ? "0px" : "calc(56px + env(safe-area-inset-top, 0px))");
}
