import type { Messages } from "./i18n";
import { useGrokTheme } from "./ui";
import { hardReloadPage } from "./pwa-reload";

function ReloadIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4v6h6M20 20v-6h-6M6.5 17.5a7 7 0 0 1 9.9-9.9M17.5 6.5a7 7 0 0 1-9.9 9.9"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReloadButton({ t }: { t: Messages }) {
  const theme = useGrokTheme();

  return (
    <button
      type="button"
      className="top-nav-icon-btn top-nav-control"
      data-testid="reload-btn"
      title={t.nav.reload}
      aria-label={t.nav.reload}
      onClick={() => void hardReloadPage()}
      style={{
        border: `1px solid ${theme.border.default}`,
        background: theme.bg.elevated,
        color: theme.text.primary,
      }}
    >
      <ReloadIcon stroke={theme.text.primary} />
    </button>
  );
}