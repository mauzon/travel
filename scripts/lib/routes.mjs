/** Shared walk/taxi route math from an origin point to a place. */

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function cacheKey(lat1, lng1, lat2, lng2) {
  return `${lat1},${lng1}->${lat2},${lng2}`;
}

export function fmtKm(km, locale = "ru") {
  const s = km.toFixed(1);
  return locale === "ru" ? s.replace(".", ",") : s;
}

function fareSymbol(currency) {
  if (currency === "EUR") return "€";
  if (currency === "GBP") return "£";
  if (currency === "USD") return "$";
  return "฿";
}

export function taxiFare(km, taxiModel) {
  const base = taxiModel.base_fare_thb;
  const extraKm = Math.max(0, km - 1);
  const low = Math.round(base + extraKm * taxiModel.per_km_thb_min);
  const high = Math.round(base + extraKm * taxiModel.per_km_thb_max);
  return { low: Math.max(low, base), high: Math.max(high, low + 10) };
}

export function buildRouteBundle(origin, place, drive, city, locale = "ru") {
  const taxiModel = city.transport.taxi;
  const traffic = taxiModel.traffic_factor;
  const walkSpeed = city.routing?.walk_speed_kmh ?? 4.7;

  const walkKm = haversineKm(origin, place) * 1.25;
  const walkMin = Math.round((walkKm / walkSpeed) * 60);
  const walkPractical = walkKm <= 3.5;
  const walkLabel =
    locale === "en"
      ? walkPractical
        ? `${walkMin} min · ${fmtKm(walkKm, "en")} km`
        : `far (~${fmtKm(walkKm, "en")} km)`
      : walkPractical
        ? `${walkMin} мин · ${fmtKm(walkKm)} км`
        : `далеко (~${fmtKm(walkKm)} км)`;

  const km = drive.distance_m / 1000;
  const minBase = (drive.duration_s / 60) * traffic;
  const minLow = Math.max(1, Math.round(minBase * 0.85));
  const minHigh = Math.max(minLow + 1, Math.round(minBase * 1.15));
  const fare = taxiFare(km, taxiModel);
  const sym = fareSymbol(city.currency);
  const taxiLabel =
    locale === "en"
      ? `${minLow}–${minHigh} min · ${fmtKm(km, "en")} km · ${sym}${fare.low}–${fare.high}`
      : `${minLow}–${minHigh} мин · ${fmtKm(km)} км · ${fare.low}–${fare.high} ${sym}`;

  return {
    walk: { km: walkKm, min: walkMin, practical: walkPractical, label: walkLabel },
    taxi: {
      km,
      min_low: minLow,
      min_high: minHigh,
      thb_min: fare.low,
      thb_max: fare.high,
      label: taxiLabel,
    },
    sort_km: km,
  };
}

export function defaultOriginId(city) {
  if (!city.origins?.length) return "hotel";
  return city.origins.find((o) => o.default)?.id ?? city.origins[0].id;
}

export function syncLegacyRoutes(place, originId) {
  const r = place.routes?.[originId];
  if (!r) return;
  place.walk = r.walk;
  place.taxi = r.taxi;
  if (r.transit) place.transit = r.transit;
  place.sort_km = r.sort_km;
}
