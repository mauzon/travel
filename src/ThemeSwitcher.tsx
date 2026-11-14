import type { Messages } from "./i18n";
import { setColorSchemePref, useGrokTheme } from "./ui";

function SunIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke={stroke} strokeWidth="2" />
      <path
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeSwitcher({ t }: { t: Messages }) {
  const theme = useGrokTheme();
  const isDark = theme.kind === "dark";
  const aria = isDark ? t.theme.switchToLight : t.theme.switchToDark;

  return (
    <button
      type="button"
      className="top-nav-icon-btn top-nav-control"
      data-testid="theme-switcher"
      data-theme-effective={theme.kind}
      title={aria}
      aria-label={aria}
      onClick={() => setColorSchemePref(isDark ? "light" : "dark")}
      style={{
        border: `1px solid ${theme.border.default}`,
        background: theme.bg.elevated,
        color: theme.text.primary,
      }}
    >
      {isDark ? <SunIcon stroke={theme.text.primary} /> : <MoonIcon stroke={theme.text.primary} />}
    </button>
  );
}
