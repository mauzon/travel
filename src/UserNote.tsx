import type { CSSProperties, ReactNode } from "react";
import { useGrokTheme } from "./ui";

const URL_RE = /https?:\/\/[^\s<]+/gi;

function shortUrlLabel(href: string): string {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    return `${host} ↗`;
  } catch {
    return "link ↗";
  }
}

function linkifyText(text: string, accent: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0];
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a key={`${start}-${url}`} href={url} target="_blank" rel="noopener noreferrer" style={{ color: accent }}>
        {shortUrlLabel(url)}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

export function UserNoteBlock({
  note,
  label,
}: {
  note: string;
  label: string;
}) {
  const theme = useGrokTheme();
  const box: CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    padding: "10px 12px",
    borderLeft: `3px solid ${theme.text.accent}`,
    borderRadius: theme.radius.md,
    background: theme.bg.subtle,
    fontFamily: theme.font.family,
    fontSize: theme.font.subtext.fontSize,
    lineHeight: theme.font.subtext.lineHeight,
    color: theme.text.primary,
  };
  const labelStyle: CSSProperties = {
    flexShrink: 0,
    fontWeight: theme.weight.semibold,
    color: theme.text.secondary,
    fontSize: theme.font.caption.fontSize,
  };
  return (
    <div className="user-note-block" style={box}>
      <span aria-hidden="true">📝</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={labelStyle}>{label}</div>
        <div style={{ marginTop: 4, fontStyle: "italic", wordBreak: "break-word" }}>
          {linkifyText(note, theme.text.accent)}
        </div>
      </div>
    </div>
  );
}

export function DescriptionBlock({ text }: { text: string }) {
  const theme = useGrokTheme();
  return (
    <div
      style={{
        fontFamily: theme.font.family,
        fontSize: theme.font.subtext.fontSize,
        lineHeight: theme.font.subtext.lineHeight,
        color: theme.text.secondary,
      }}
    >
      {text}
    </div>
  );
}
