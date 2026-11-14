import type { CSSProperties } from "react";
import { useGrokTheme } from "./ui";

export function ListSourceIcon({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  const theme = useGrokTheme();
  const color = style?.color ?? theme.text.secondary;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SparklesSourceIcon({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  const theme = useGrokTheme();
  const color = style?.color ?? theme.text.accent;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={style}>
      <path d="M9.5 2 8 7.5 2.5 9 8 10.5 9.5 16l1.5-5.5L17.5 9 11 7.5 9.5 2zm5 6.5L17 12l-2.5 3.5L12 17l2.5-1.5L17 12l-2.5-3.5zM5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
    </svg>
  );
}

export function SourceIconBadge({
  kind,
  label,
  tone,
}: {
  kind: "list" | "sparkles";
  label: string;
  tone: "success" | "accent";
}) {
  const theme = useGrokTheme();
  const map = {
    success: { bg: theme.fill.successSubtle, fg: theme.text.success },
    accent: { bg: theme.fill.accentSubtle, fg: theme.text.accent },
  }[tone];
  return (
    <span
      className="source-icon-badge"
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: map.bg,
        color: map.fg,
        borderRadius: theme.radius.full,
        padding: "3px 7px",
        lineHeight: 0,
      }}
    >
      {kind === "list" ? (
        <ListSourceIcon size={14} style={{ color: map.fg }} />
      ) : (
        <SparklesSourceIcon size={14} style={{ color: map.fg }} />
      )}
    </span>
  );
}
