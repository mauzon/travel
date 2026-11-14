import { buildCanonicalMapsUrl } from "../lib/google-maps-links.mjs";
import type { OriginRow, PlaceRow } from "./types";

type MapsCtx = {
  name?: string;
  name_en?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

export function resolvePlaceMapsUrl(place: PlaceRow, cityName?: string): string {
  if (place.google) {
    return buildCanonicalMapsUrl(place.google, {
      name: place.name,
      name_en: place.name_en,
      address: (place as MapsCtx & PlaceRow).address,
      cityName,
      lat: place.lat,
      lng: place.lng,
    });
  }
  return place.maps_url;
}

export function resolveHotelMapsUrl(
  hotel: MapsCtx & { maps_url: string; google?: PlaceRow["google"] },
  cityName?: string,
): string {
  if (hotel.google) {
    return buildCanonicalMapsUrl(hotel.google, {
      name: hotel.name,
      name_en: hotel.name_en,
      address: hotel.address,
      cityName,
      lat: hotel.lat,
      lng: hotel.lng,
    });
  }
  return hotel.maps_url;
}

export function resolveOriginMapsUrl(origin: OriginRow, cityName?: string): string {
  if (origin.google) {
    return buildCanonicalMapsUrl(origin.google, {
      name: origin.label_en || origin.label_ru,
      cityName,
      lat: origin.lat,
      lng: origin.lng,
    });
  }
  return origin.google_maps_url || "";
}