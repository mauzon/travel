export type GrokTextStyle = {
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  fontVariationSettings?: string;
};

type Palette = {
  bg: { base: string; subtle: string; elevated: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    onColor: string;
    onPrimary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    accentDeep: string;
    successDeep: string;
    warningDeep: string;
    dangerDeep: string;
  };
  fill: {
    primary: string;
    primaryHover: string;
    secondary: string;
    secondaryHover: string;
    hover: string;
    pressed: string;
    accent: string;
    controlChecked: string;
    accentSubtle: string;
    successSubtle: string;
    warningSubtle: string;
    dangerSubtle: string;
  };
  border: {
    subtle: string;
    weak: string;
    default: string;
    strong: string;
    focus: string;
  };
};

export type GrokTheme = Palette & {
  kind: "light" | "dark";
  font: {
    family: string;
    mono: string;
    heading1: GrokTextStyle;
    heading2: GrokTextStyle;
    heading3: GrokTextStyle;
    body1: GrokTextStyle;
    subtext: GrokTextStyle;
    table: GrokTextStyle;
    metric: GrokTextStyle;
    body2: GrokTextStyle;
    label: GrokTextStyle;
    caption: GrokTextStyle;
    code: GrokTextStyle;
  };
  weight: { regular: 400; medium: 500; semibold: 600 };
  radius: { sm: 4; md: 8; lg: 12; xl: 16; full: 9999 };
  motion: { hover: string; easing: string };
  dataviz: Record<string, unknown>;
  chart: [string, string, string, string];
};

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif';
const mono =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

const type = {
  heading1: { fontSize: "1.75rem", lineHeight: "2.2rem", letterSpacing: "-0.03em" },
  heading2: { fontSize: "1.25rem", lineHeight: "1.7rem", letterSpacing: "-0.02em" },
  heading3: { fontSize: "1.0625rem", lineHeight: "1.5rem", letterSpacing: "-0.015em" },
  body1: { fontSize: "1rem", lineHeight: "1.55rem", letterSpacing: "-0.011em" },
  body2: { fontSize: "0.9375rem", lineHeight: "1.45rem", letterSpacing: "-0.01em" },
  subtext: { fontSize: "0.875rem", lineHeight: "1.4rem", letterSpacing: "-0.006em" },
  table: { fontSize: "0.875rem", lineHeight: "1.35rem", letterSpacing: "-0.006em" },
  metric: { fontSize: "1.75rem", lineHeight: "2rem", letterSpacing: "-0.03em" },
  label: { fontSize: "0.8125rem", lineHeight: "1.15rem", letterSpacing: "0" },
  caption: { fontSize: "0.75rem", lineHeight: "1.1rem", letterSpacing: "0.004em" },
  code: { fontSize: "0.8125rem", lineHeight: "1.25rem", letterSpacing: "0" },
};

const shared = {
  font: { family: fontFamily, mono, ...type },
  weight: { regular: 400 as const, medium: 500 as const, semibold: 600 as const },
  radius: { sm: 4 as const, md: 8 as const, lg: 12 as const, xl: 16 as const, full: 9999 as const },
  motion: { hover: "120ms", easing: "cubic-bezier(0.2, 0, 0, 1)" },
  dataviz: {},
  chart: ["#3B82F6", "#EAB308", "#06B6D4", "#9CA3AF"] as [string, string, string, string],
};

export const lightTheme: GrokTheme = {
  kind: "light",
  ...shared,
  bg: { base: "#F7F7F5", subtle: "#EFEFEA", elevated: "#FFFFFF" },
  text: {
    primary: "#171717",
    secondary: "rgba(23, 23, 23, 0.62)",
    tertiary: "rgba(23, 23, 23, 0.42)",
    onColor: "#FFFFFF",
    onPrimary: "#FFFFFF",
    accent: "#1D4ED8",
    success: "#15803D",
    warning: "#B45309",
    danger: "#DC2626",
    accentDeep: "#1E3A8A",
    successDeep: "#14532D",
    warningDeep: "#92400E",
    dangerDeep: "#991B1B",
  },
  fill: {
    primary: "#171717",
    primaryHover: "#2A2A2A",
    secondary: "rgba(23, 23, 23, 0.09)",
    secondaryHover: "rgba(23, 23, 23, 0.15)",
    hover: "rgba(23, 23, 23, 0.06)",
    pressed: "rgba(23, 23, 23, 0.09)",
    accent: "#1D4ED8",
    controlChecked: "#171717",
    accentSubtle: "rgba(29, 78, 216, 0.09)",
    successSubtle: "rgba(21, 128, 61, 0.10)",
    warningSubtle: "rgba(180, 83, 9, 0.12)",
    dangerSubtle: "rgba(220, 38, 38, 0.10)",
  },
  border: {
    subtle: "rgba(23, 23, 23, 0.05)",
    weak: "rgba(23, 23, 23, 0.10)",
    default: "rgba(23, 23, 23, 0.15)",
    strong: "rgba(23, 23, 23, 0.30)",
    focus: "rgba(23, 23, 23, 0.40)",
  },
};

export const darkTheme: GrokTheme = {
  kind: "dark",
  ...shared,
  bg: { base: "#111111", subtle: "#1A1A1A", elevated: "#1C1C1C" },
  text: {
    primary: "#F4F4F0",
    secondary: "rgba(244, 244, 240, 0.62)",
    tertiary: "rgba(244, 244, 240, 0.42)",
    onColor: "#111111",
    onPrimary: "#111111",
    accent: "#93C5FD",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
    accentDeep: "#BFDBFE",
    successDeep: "#BBF7D0",
    warningDeep: "#FDE68A",
    dangerDeep: "#FECACA",
  },
  fill: {
    primary: "#F4F4F0",
    primaryHover: "#FFFFFF",
    secondary: "rgba(244, 244, 240, 0.17)",
    secondaryHover: "rgba(244, 244, 240, 0.28)",
    hover: "rgba(244, 244, 240, 0.08)",
    pressed: "rgba(244, 244, 240, 0.12)",
    accent: "#93C5FD",
    controlChecked: "#F4F4F0",
    accentSubtle: "rgba(147, 197, 253, 0.17)",
    successSubtle: "rgba(74, 222, 128, 0.17)",
    warningSubtle: "rgba(251, 191, 36, 0.17)",
    dangerSubtle: "rgba(248, 113, 113, 0.17)",
  },
  border: {
    subtle: "rgba(244, 244, 240, 0.05)",
    weak: "rgba(244, 244, 240, 0.10)",
    default: "rgba(244, 244, 240, 0.15)",
    strong: "rgba(244, 244, 240, 0.30)",
    focus: "rgba(244, 244, 240, 0.40)",
  },
};

export function themeFromKind(kind: "light" | "dark"): GrokTheme {
  return kind === "dark" ? darkTheme : lightTheme;
}

/** @deprecated use theme-preference + themeFromKind */
export function themeFromPreference(): GrokTheme {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return darkTheme;
  }
  return lightTheme;
}
