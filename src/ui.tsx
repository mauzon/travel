import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { themeFromKind, type GrokTheme } from "./theme";
import {
  applyColorSchemeToDocument,
  hasExplicitColorScheme,
  readColorSchemePref,
  type ColorSchemePref,
  writeColorSchemePref,
} from "./theme-preference";

export { hasExplicitColorScheme };

export { useEffect, useMemo, useState };
export type { CSSProperties };

let themeListeners = new Set<(t: GrokTheme) => void>();
let colorSchemePref: ColorSchemePref =
  typeof window !== "undefined" ? readColorSchemePref() : "auto";

function syncThemeFromPreference() {
  const kind =
    colorSchemePref === "light"
      ? "light"
      : colorSchemePref === "dark"
        ? "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  applyColorSchemeToDocument(colorSchemePref);
  const next = themeFromKind(kind);
  currentTheme = next;
  if (document.body) document.body.style.fontFamily = next.font.family;
  themeListeners.forEach((fn) => fn(next));
  return next;
}

let currentTheme = typeof window !== "undefined" ? syncThemeFromPreference() : themeFromKind("light");

export function setColorSchemePref(pref: ColorSchemePref) {
  colorSchemePref = pref;
  writeColorSchemePref(pref);
  syncThemeFromPreference();
}

if (typeof window !== "undefined") {
  applyColorSchemeToDocument(readColorSchemePref());
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    if (!hasExplicitColorScheme()) syncThemeFromPreference();
  });
}

export function useGrokTheme(): GrokTheme {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    themeListeners.add(setTheme);
    setTheme(currentTheme);
    return () => {
      themeListeners.delete(setTheme);
    };
  }, []);
  return theme;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Page({
  title,
  subtitle,
  belowHeader,
  sources,
  sourcesHeading = "Sources",
  headerAside,
  width = "column",
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  belowHeader?: ReactNode;
  sources?: string[];
  sourcesHeading?: string;
  headerAside?: ReactNode;
  width?: "column" | "wide" | "full";
  children?: ReactNode;
}) {
  const theme = useGrokTheme();
  return (
    <div className={cx("page", `page-${width}`, "page-with-top-nav")}>
      <header className="page-header">
        <div className="page-header-row">
          <div className="page-header-titles">
            <h1 style={{ ...theme.font.heading1, fontWeight: theme.weight.semibold, color: theme.text.primary, margin: 0 }}>
              {title}
            </h1>
            {subtitle ?? null}
          </div>
          {headerAside ? <div className="page-header-aside">{headerAside}</div> : null}
        </div>
        {belowHeader ? <div className="page-summary-panel">{belowHeader}</div> : null}
      </header>
      <main className="page-main">{children}</main>
      {sources && sources.length > 0 ? (
        <footer className="page-sources">
          <Section heading={sourcesHeading} collapsible defaultOpen={false}>
            <ul className="sources-list">
              {sources.map((href) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {href}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        </footer>
      ) : null}
    </div>
  );
}

export function Section({
  heading,
  headingCount,
  caption,
  collapsible,
  defaultOpen = true,
  children,
}: {
  heading?: string;
  headingCount?: number | string;
  id?: string;
  caption?: string;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const theme = useGrokTheme();
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const title =
    heading != null && headingCount != null && String(headingCount) !== ""
      ? `${heading} (${headingCount})`
      : heading;
  return (
    <section className="section">
      {title ? (
        <div className="section-head">
          {collapsible ? (
            <button
              type="button"
              className="section-toggle"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className={cx("chevron", open && "open")} aria-hidden="true" />
              <h2 style={{ ...theme.font.heading2, fontWeight: theme.weight.semibold, margin: 0, color: theme.text.primary }}>
                {title}
              </h2>
            </button>
          ) : (
            <h2 style={{ ...theme.font.heading2, fontWeight: theme.weight.semibold, margin: 0, color: theme.text.primary }}>
              {title}
            </h2>
          )}
          {caption ? (
            <p className="section-caption" style={{ ...theme.font.caption, color: theme.text.tertiary, margin: "4px 0 0" }}>
              {caption}
            </p>
          ) : null}
        </div>
      ) : null}
      {!collapsible || open ? <div className="section-body">{children}</div> : null}
    </section>
  );
}

export function Text({ children }: { children?: ReactNode }) {
  const theme = useGrokTheme();
  return (
    <p style={{ ...theme.font.body1, color: theme.text.primary, margin: "0 0 12px" }}>{children}</p>
  );
}

export function Callout({
  lead,
  tone = "info",
  children,
}: {
  lead?: string;
  tone?: "info" | "success" | "warning" | "danger";
  children?: ReactNode;
}) {
  const theme = useGrokTheme();
  const bg =
    tone === "warning"
      ? theme.fill.warningSubtle
      : tone === "success"
        ? theme.fill.successSubtle
        : tone === "danger"
          ? theme.fill.dangerSubtle
          : theme.fill.accentSubtle;
  const ink =
    tone === "warning"
      ? theme.text.warningDeep
      : tone === "success"
        ? theme.text.successDeep
        : tone === "danger"
          ? theme.text.dangerDeep
          : theme.text.accentDeep;
  const title =
    tone === "warning"
      ? theme.text.warning
      : tone === "success"
        ? theme.text.success
        : tone === "danger"
          ? theme.text.danger
          : theme.text.accent;
  return (
    <aside className="callout" style={{ background: bg, borderRadius: theme.radius.lg, padding: "14px 16px" }}>
      {lead ? (
        <div style={{ ...theme.font.subtext, fontWeight: theme.weight.semibold, color: title, marginBottom: 4 }}>
          {lead}
        </div>
      ) : null}
      <div style={{ ...theme.font.subtext, color: ink }}>{children}</div>
    </aside>
  );
}

export function Metrics({
  metrics,
}: {
  metrics: Array<{
    value: string;
    label?: string;
    icon?: "list" | "sparkles";
    detail?: string;
    tone?: string;
    key?: string;
  }>;
}) {
  const theme = useGrokTheme();
  return (
    <div className="metrics">
      {metrics.map((m, i) => (
        <div
          key={m.key ?? m.label ?? String(i)}
          className="metric"
          style={{
            background: theme.bg.elevated,
            border: `1px solid ${theme.border.default}`,
            borderRadius: theme.radius.lg,
            padding: "14px 16px",
          }}
        >
          <div className="metric-value-row">
            {m.icon ? (
              <span
                className={m.icon === "sparkles" ? "metric-icon-wrap metric-icon-wrap--sparkles" : "metric-icon-wrap"}
                title={m.label}
                aria-label={m.label}
              >
                {m.icon === "list" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M9.5 2 8 7.5 2.5 9 8 10.5 9.5 16l1.5-5.5L17.5 9 11 7.5 9.5 2zm5 6.5L17 12l-2.5 3.5L12 17l2.5-1.5L17 12l-2.5-3.5zM5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
                  </svg>
                )}
              </span>
            ) : null}
            <div style={{ ...theme.font.metric, fontWeight: theme.weight.semibold, color: theme.text.primary }}>
              {m.value}
            </div>
          </div>
          {m.label && !m.icon ? (
            <div style={{ ...theme.font.label, fontWeight: theme.weight.medium, color: theme.text.secondary, marginTop: 4 }}>
              {m.label}
            </div>
          ) : null}
          {m.detail ? (
            <div style={{ ...theme.font.caption, color: theme.text.tertiary, marginTop: 2 }}>{m.detail}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<T | { value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useGrokTheme();
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="segmented" role="tablist" style={{ background: theme.fill.secondary, borderRadius: theme.radius.lg }}>
      {items.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("segment", active && "active")}
            style={{
              background: active ? theme.bg.elevated : "transparent",
              color: theme.text.primary,
              fontWeight: active ? theme.weight.semibold : theme.weight.medium,
              boxShadow: active ? `0 1px 2px rgba(0,0,0,0.08)` : "none",
              fontFamily: theme.font.family,
              fontSize: theme.font.subtext.fontSize,
            }}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {opt.count != null ? <span className="seg-count">{opt.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  selectClassName,
  selectDataTestId,
}: {
  label?: string;
  options: Array<T | { value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  selectClassName?: string;
  selectDataTestId?: string;
}) {
  const theme = useGrokTheme();
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <label className="field">
      {label ? <span className="sr-only">{label}</span> : null}
      <select
        className={selectClassName}
        data-testid={selectDataTestId}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ fontFamily: theme.font.family }}
      >
        {placeholder && !items.some((i) => i.value === value) ? (
          <option value="">{placeholder}</option>
        ) : null}
        {items.map((i) => (
          <option key={i.value} value={i.value}>
            {i.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  const theme = useGrokTheme();
  return (
    <label className="field">
      {label ? <span className="sr-only">{label}</span> : null}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        aria-label={label || placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: theme.font.family }}
      />
    </label>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useGrokTheme();
  return (
    <label className={cx("toggle", value && "on", disabled && "disabled")}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className="toggle-track"
        style={{
          background: value ? theme.fill.controlChecked : theme.fill.secondary,
        }}
        aria-hidden="true"
      >
        <span className="toggle-knob" />
      </span>
      {label ? (
        <span style={{ ...theme.font.subtext, color: theme.text.primary }}>{label}</span>
      ) : null}
    </label>
  );
}

export function Status({
  tone = "neutral",
  children,
}: {
  tone?: "success" | "warning" | "danger" | "accent" | "neutral";
  children: ReactNode;
}) {
  const theme = useGrokTheme();
  const map = {
    success: { bg: theme.fill.successSubtle, fg: theme.text.success },
    warning: { bg: theme.fill.warningSubtle, fg: theme.text.warning },
    danger: { bg: theme.fill.dangerSubtle, fg: theme.text.danger },
    accent: { bg: theme.fill.accentSubtle, fg: theme.text.accent },
    neutral: { bg: theme.fill.secondary, fg: theme.text.secondary },
  }[tone];
  return (
    <span
      className="status"
      style={{
        background: map.bg,
        color: map.fg,
        borderRadius: theme.radius.full,
        fontFamily: theme.font.family,
        fontSize: theme.font.caption.fontSize,
        lineHeight: theme.font.caption.lineHeight,
        fontWeight: theme.weight.medium,
      }}
    >
      {children}
    </span>
  );
}

export function TextLink({ href, children }: { href: string; children?: ReactNode }) {
  const theme = useGrokTheme();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: theme.text.accent,
        fontFamily: theme.font.family,
        fontSize: theme.font.subtext.fontSize,
        fontWeight: theme.weight.medium,
        textDecoration: "underline",
        textUnderlineOffset: 2,
      }}
    >
      {children}
    </a>
  );
}

export function Footnote({ children }: { children?: ReactNode }) {
  const theme = useGrokTheme();
  return (
    <p className="footnote" style={{ ...theme.font.caption, color: theme.text.tertiary, margin: "8px 0 0" }}>
      {children}
    </p>
  );
}

export function Properties({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  const theme = useGrokTheme();
  return (
    <dl className="properties">
      {items.map((item) => (
        <div key={item.label} className="prop-row">
          <dt style={{ ...theme.font.caption, color: theme.text.tertiary }}>{item.label}</dt>
          <dd style={{ ...theme.font.subtext, color: theme.text.primary, margin: 0 }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BackToTop({ label = "Back to top" }: { label?: string }) {
  const theme = useGrokTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      style={{
        fontFamily: theme.font.family,
        fontSize: theme.font.subtext.fontSize,
        fontWeight: theme.weight.medium,
        color: theme.text.primary,
        background: theme.bg.elevated,
        border: `1px solid ${theme.border.default}`,
        borderRadius: theme.radius.full,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      }}
    >
      {label}
    </button>
  );
}
