import type { Locale } from "./i18n";
import type { Messages } from "./i18n";
import type { CityData, PlaceRow } from "./types";

export type Origin = NonNullable<CityData["origins"]>[number];

export function defaultOriginId(origins: Origin[]): string {
  if (!origins.length) return "hotel";
  return origins.find((o) => o.default)?.id ?? origins[0].id;
}

export function originStorageKey(slug: string) {
  return `travel-origin-${slug}`;
}

export function readInitialOrigin(slug: string, origins: Origin[]): string {
  const def = defaultOriginId(origins);
  if (typeof window === "undefined") return def;
  const from = new URLSearchParams(window.location.search).get("from");
  if (from && origins.some((o) => o.id === from)) return from;
  try {
    const saved = localStorage.getItem(originStorageKey(slug));
    if (saved && origins.some((o) => o.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return def;
}

export function persistOrigin(slug: string, id: string) {
  try {
    localStorage.setItem(originStorageKey(slug), id);
  } catch {
    /* ignore */
  }
}

export function syncOriginQuery(defaultId: string, originId: string) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (originId === defaultId) u.searchParams.delete("from");
  else u.searchParams.set("from", originId);
  const q = u.searchParams.toString();
  const next = u.pathname + (q ? `?${q}` : "") + u.hash;
  if (next !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(null, "", next);
  }
}

export function originLabel(o: Origin, locale: Locale): string {
  return locale === "en" ? o.label_en || o.label_ru : o.label_ru;
}

/** Section title from origin labels only (templates in i18n). */
export function originsSectionHeading(origins: Origin[], locale: Locale, t: Messages): string {
  const labels = origins.map((o) => originLabel(o, locale));
  if (labels.length === 0) return "";
  if (labels.length === 1) return t.origins.sectionOne(labels[0]);
  if (labels.length === 2) return t.origins.sectionTwo(labels[0], labels[1]);
  const last = labels[labels.length - 1];
  const leading = labels.slice(0, -1).join(locale === "en" ? ", " : ", ");
  return t.origins.sectionMany(leading, last);
}

export function originMatchesHotel(o: Origin, hotel: CityData["hotel"]): boolean {
  return Math.abs(o.lat - hotel.lat) < 1e-5 && Math.abs(o.lng - hotel.lng) < 1e-5;
}

export function parseSortKey(sortKey: string): { mode: "distance" | "category" | "name"; originId?: string } {
  if (sortKey.startsWith("distance:")) {
    return { mode: "distance", originId: sortKey.slice("distance:".length) };
  }
  if (sortKey === "category" || sortKey === "name") return { mode: sortKey };
  return { mode: "distance", originId: "hotel" };
}

export function sortKeyForOrigin(originId: string): string {
  return `distance:${originId}`;
}

export function placeWithOrigin(p: PlaceRow, originId: string): PlaceRow {
  const r = p.routes?.[originId];
  if (!r) return p;
  return {
    ...p,
    walk: r.walk ?? p.walk,
    taxi: r.taxi ?? p.taxi,
    transit: r.transit ?? p.transit,
    sort_km: r.sort_km ?? p.sort_km,
  };
}

export function resolveOrigins(data: CityData): Origin[] {
  if (data.origins?.length) return data.origins;
  const h = data.hotel;
  return [
    {
      id: "hotel",
      label_ru: h.name,
      label_en: h.name_en || h.name,
      kind: "hotel",
      default: true,
      lat: h.lat,
      lng: h.lng,
      google_maps_url: h.maps_url,
    },
  ];
}
