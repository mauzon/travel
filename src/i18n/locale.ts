import type { Locale } from "./index";
import type { PlaceRow } from "../types";
import type { CityData } from "../types";

/** Light-touch EN labels for route strings when description_en is absent. */
export function localizeRouteLabel(label: string, locale: Locale): string {
  if (!label || locale === "ru") return label;
  return label
    .replace(/(\d+),(\d+)\s*км/g, "$1.$2 km")
    .replace(/(\d+)\s*мин/g, "$1 min")
    .replace(/далеко/gi, "too far")
    .replace(/удобнее пешком/gi, "walking is easier")
    .replace(/через реку, прямого пути нет/gi, "across the river; no direct walking route")
    .replace(/฿/g, "฿");
}

export function placeName(p: PlaceRow, locale: Locale): string {
  if (locale === "en") return p.name_en || p.name_ru || p.name;
  return p.name_ru || p.name;
}

export function placeDescription(p: PlaceRow, locale: Locale): string | undefined {
  if (locale === "en") return p.description_en || p.description;
  return p.description;
}

export function placeUserNote(p: PlaceRow): string | undefined {
  return p.user_note || undefined;
}

export function placeWarning(p: PlaceRow, locale: Locale): string | undefined {
  if (locale === "en") return p.warning_en || p.warning;
  return p.warning;
}

export function placeSchedule(p: PlaceRow, locale: Locale): string | undefined {
  if (locale === "en") return p.schedule_en || p.schedule_text;
  return p.schedule_text;
}

export function placeDistrict(p: PlaceRow, locale: Locale): string | undefined {
  if (locale === "en") return p.district_en || p.district;
  return p.district;
}

export function transitDescription(p: PlaceRow, locale: Locale): string {
  const d = p.transit?.description || "";
  if (locale === "en") return p.transit?.description_en || localizeRouteLabel(d, "en");
  return d;
}

export function walkLabel(p: PlaceRow, locale: Locale): string {
  const d = p.walk?.label || "";
  return locale === "en" ? p.walk?.label_en || localizeRouteLabel(d, "en") : d;
}

export function taxiLabel(p: PlaceRow, locale: Locale): string {
  const d = p.taxi?.label || "";
  return locale === "en" ? p.taxi?.label_en || localizeRouteLabel(d, "en") : d;
}

export function cityDisplayName(data: CityData, locale: Locale): string {
  if (locale === "en") return data.name_en || data.name_ru;
  return data.name_ru;
}

export function uiSummary(data: CityData, locale: Locale): string | undefined {
  if (locale === "en") return data.ui?.summary_en || data.ui?.summary;
  return data.ui?.summary;
}

export function uiCallout(
  data: CityData,
  key: "warning" | "info",
  locale: Locale,
): { lead: string; body: string } | undefined {
  const c = data.ui?.callouts?.[key];
  if (!c) return undefined;
  if (locale === "en") {
    return { lead: c.lead_en || c.lead, body: c.body_en || c.body };
  }
  return { lead: c.lead, body: c.body };
}

export function hotelTransit(hotel: CityData["hotel"], locale: Locale): string {
  if (locale === "en") return hotel.transit_description_en || hotel.transit_description || "";
  return hotel.transit_description || "";
}

export function hotelDistrict(hotel: CityData["hotel"], locale: Locale): string {
  if (locale === "en") return hotel.district_en || hotel.district || "";
  return hotel.district || "";
}
