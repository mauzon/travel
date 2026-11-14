import { useGrokTheme, TextLink } from "./ui";
import type { CSSProperties, MouseEvent } from "react";

export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export async function shareMapsUrl(
  opts: { title: string; text: string; url: string },
  onCopied: () => void,
): Promise<void> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(opts);
      return;
    } catch (err) {
      const name = err && typeof err === "object" && "name" in err ? String((err as Error).name) : "";
      if (name === "AbortError") return;
    }
  }
  await copyText(opts.url);
  onCopied();
}

function MapsPinIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22s7-7.2 7-12.2A7 7 0 1 0 5 9.8C5 14.8 12 22 12 22z"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      <circle cx="12" cy="9.5" r="2.4" fill={color} />
    </svg>
  );
}

function ShareIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0 4 4m-4-4L8 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="5" y="10" width="14" height="11" rx="2" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  );
}

export function ShareToast({ visible, message = "Link copied" }: { visible: boolean; message?: string }) {
  const theme = useGrokTheme();
  if (!visible) return null;
  const style: CSSProperties = {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 30,
    padding: "10px 16px",
    borderRadius: theme.radius.lg,
    background: theme.bg.elevated,
    border: `1px solid ${theme.border.default}`,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    fontFamily: theme.font.family,
    fontSize: theme.font.subtext.fontSize,
    color: theme.text.primary,
    pointerEvents: "none",
  };
  return (
    <div role="status" aria-live="polite" className="share-toast" style={style}>
      {message}
    </div>
  );
}

export function MapsActions({
  mapsUrl,
  name,
  categoryLabel,
  shareLabel,
  mapsLinkLabel,
  onCopied,
}: {
  mapsUrl: string;
  name: string;
  categoryLabel: string;
  shareLabel: string;
  mapsLinkLabel: string;
  onCopied: () => void;
}) {
  const theme = useGrokTheme();
  const accent = theme.text.accent;

  const onShare = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    void shareMapsUrl(
      {
        title: name,
        text: `${name} — ${categoryLabel}`,
        url: mapsUrl,
      },
      onCopied,
    );
  };

  return (
    <span className="maps-actions" onClick={(e) => e.stopPropagation()}>
      <MapsPinIcon color={accent} />
      <TextLink href={mapsUrl}>{mapsLinkLabel}</TextLink>
      <button
        type="button"
        className="share-btn"
        aria-label={shareLabel}
        title={shareLabel}
        onClick={onShare}
        style={{ color: accent }}
      >
        <ShareIcon color="currentColor" />
      </button>
    </span>
  );
}

export function HotelMapsActions({
  mapsUrl,
  name,
  categoryLabel,
  shareLabel,
  openMapsLabel,
  onCopied,
}: {
  mapsUrl: string;
  name: string;
  categoryLabel: string;
  shareLabel: string;
  openMapsLabel: string;
  onCopied: () => void;
}) {
  const theme = useGrokTheme();
  const accent = theme.text.accent;

  const onShare = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    void shareMapsUrl(
      {
        title: name,
        text: `${name} — ${categoryLabel}`,
        url: mapsUrl,
      },
      onCopied,
    );
  };

  return (
    <span className="maps-actions" onClick={(e) => e.stopPropagation()}>
      <TextLink href={mapsUrl}>{openMapsLabel}</TextLink>
      <button
        type="button"
        className="share-btn"
        aria-label={shareLabel}
        title={shareLabel}
        onClick={onShare}
        style={{ color: accent }}
      >
        <ShareIcon color="currentColor" />
      </button>
    </span>
  );
}
