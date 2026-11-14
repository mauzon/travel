export type ColorSchemePref = "auto" | "light" | "dark";

const STORAGE_KEY = "travel-color-scheme";

export function readColorSchemePref(): ColorSchemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    if (v === "auto") return "auto";
  } catch {
    /* ignore */
  }
  return "auto";
}

/** User chose light/dark explicitly (not system-follow). */
export function hasExplicitColorScheme(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark";
  } catch {
    return false;
  }
}

export function writeColorSchemePref(pref: ColorSchemePref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function resolvedColorKind(pref: ColorSchemePref): "light" | "dark" {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** Apply `data-theme` and base colors before React paints (also used from inline HTML). */
export function applyColorSchemeToDocument(pref: ColorSchemePref) {
  if (typeof document === "undefined") return;
  const kind = resolvedColorKind(pref);
  const root = document.documentElement;
  root.setAttribute("data-theme", kind);
  root.style.colorScheme = kind;
  const bg = kind === "dark" ? "#111111" : "#F7F7F5";
  const fg = kind === "dark" ? "#F4F4F0" : "#171717";
  root.style.background = bg;
  if (document.body) {
    document.body.style.background = bg;
    document.body.style.color = fg;
  }
}
