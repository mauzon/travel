/**
 * TfL Journey Planner (no API key required at low volume; optional TFL_APP_KEY).
 * https://api.tfl.gov.uk/
 */

const MODES =
  "tube,dlr,overground,elizabeth-line,bus,walking";

function shortStation(name) {
  if (!name) return "";
  return name
    .replace(/\s+Underground Station$/i, "")
    .replace(/\s+Rail Station$/i, "")
    .replace(/\s+Station$/i, "")
    .replace(/\s+DLR Station$/i, "")
    .trim();
}

function modeId(leg) {
  const m = leg.mode;
  if (!m) return "unknown";
  if (typeof m === "string") return m;
  return m.id || m.name || "unknown";
}

function lineLabel(leg) {
  const ro = leg.routeOptions?.[0];
  if (ro?.name) return ro.name;
  const sum = leg.instruction?.summary || "";
  const m = sum.match(/^(.+?)\s+to\s+/i);
  if (m) return m[1].trim();
  return sum || "Transit";
}

export function journeyToTransit(journey, locale = "en") {
  const legs = journey.legs || [];
  let walkMin = 0;
  const parts = [];
  const modes = new Set();
  let transitLegs = 0;

  for (const leg of legs) {
    const id = modeId(leg);
    modes.add(id);
    if (id === "walking") {
      walkMin += leg.duration || 0;
      continue;
    }
    transitLegs += 1;
    if (id === "bus") {
      parts.push(leg.instruction?.summary || "Bus");
    } else if (["tube", "dlr", "elizabeth-line", "overground", "national-rail"].includes(id)) {
      const line = lineLabel(leg);
      const from = shortStation(leg.departurePoint?.commonName);
      const to = shortStation(leg.arrivalPoint?.commonName);
      parts.push(`${line} ${from} → ${to}`);
    } else {
      parts.push(leg.instruction?.summary || id);
    }
  }

  const changes = Math.max(0, transitLegs - 1);
  let description_en = parts.join("; ");
  if (walkMin > 0) description_en += (description_en ? "; " : "") + `${walkMin} min walk`;
  if (changes > 0) description_en += ` (${changes} change${changes > 1 ? "s" : ""})`;

  const farePence = journey.fare?.totalCost;
  if (typeof farePence === "number" && farePence > 0) {
    const gbp = (farePence / 100).toFixed(2);
    description_en += ` · ~£${gbp} contactless`;
  }

  let description = description_en;
  if (locale === "ru") {
    description = description_en
      .replace(/(\d+) min walk/g, "$1 мин пешком")
      .replace(/(\d+) change/g, "$1 пересадка")
      .replace(/changes/g, "пересадки")
      .replace(/contactless/g, "бесконтактно");
  }

  return {
    min: journey.duration,
    description,
    description_en,
    mode: [...modes].filter((m) => m !== "walking").join(",") || "transit",
    changes,
  };
}

export function cacheKey(from, to, date, time) {
  return `${from.lat},${from.lng}->${to.lat},${to.lng}@${date}T${time}`;
}

export async function fetchTflJourney(from, to, { date, time, cache, cachePath, delayMs }) {
  const key = cacheKey(from, to, date, time);
  if (cache[key]) return cache[key];

  const url =
    `https://api.tfl.gov.uk/Journey/JourneyResults/${from.lat},${from.lng}/to/${to.lat},${to.lng}` +
    `?mode=${MODES}&timeIs=Departing&date=${date}&time=${time}`;

  const headers = { "User-Agent": "pinkeepr/1.0 (mauzon/pinkeepr)" };
  if (process.env.TFL_APP_KEY) headers["app_key"] = process.env.TFL_APP_KEY;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TfL HTTP ${res.status}`);
  const data = await res.json();
  const journeys = data.journeys || [];
  if (!journeys.length) throw new Error("no journeys");
  journeys.sort((a, b) => (a.duration ?? 999) - (b.duration ?? 999));
  const best = journeys[0];
  const en = journeyToTransit(best, "en");
  const ru = journeyToTransit(best, "ru");
  const entry = {
    duration: best.duration,
    transit: {
      min: en.min,
      description: ru.description,
      description_en: en.description_en,
      mode: en.mode,
    },
    rawDuration: best.duration,
  };
  cache[key] = entry;
  if (cachePath) {
    const fs = await import("node:fs");
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
  }
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  return entry;
}

/** Nearest tube/rail stop names for hotel blurb (TfL StopPoint). */
export async function fetchNearestStations(lat, lng, radius = 600, limit = 4) {
  const url =
    `https://api.tfl.gov.uk/StopPoint?lat=${lat}&lon=${lng}&radius=${radius}` +
    `&stopTypes=NaptanMetroStation,NaptanRailStation`;
  const headers = { "User-Agent": "pinkeepr/1.0 (mauzon/pinkeepr)" };
  if (process.env.TFL_APP_KEY) headers["app_key"] = process.env.TFL_APP_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`StopPoint HTTP ${res.status}`);
  const data = await res.json();
  const stops = (data.stopPoints || [])
    .filter((s) => s.commonName)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    .slice(0, limit);

  const names = [...new Set(stops.map((s) => shortStation(s.commonName)))];
  const lineSet = new Set();
  for (const s of stops) {
    for (const lg of s.lineModeGroups || []) {
      for (const lid of lg.lineIdentifier || []) {
        lineSet.add(lid.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
    for (const ln of s.lines || []) {
      if (ln.name) lineSet.add(ln.name);
    }
  }
  const lines = [...lineSet].slice(0, 6);
  return { names, lines };
}

export function formatHotelTransit(names, lines) {
  const en =
    names.length && lines.length
      ? `Nearest: ${names.join(", ")} (${lines.join(", ")}). Pay-as-you-go with contactless or Oyster.`
      : names.length
        ? `Nearest stations: ${names.join(", ")}.`
        : "";
  const ru = en
    .replace(/^Nearest:/, "Рядом:")
    .replace(/^Nearest stations:/, "Ближайшие станции:")
    .replace(/Pay-as-you-go with contactless or Oyster\./, "Оплата contactless или Oyster.");
  return { transit_description: ru, transit_description_en: en };
}
