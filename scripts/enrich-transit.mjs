#!/usr/bin/env node
/**
 * Enrich public-transit legs per origin → place/event.
 *
 * Usage:
 *   npm run enrich-transit -- data/cities/london.json [--force] [--origin id]
 *   npm run enrich-transit -- demo/london/london.json --date 20270312 --time 1100
 *
 * City `routing.transit`: `tfl` | `none` | `manual` (default: none).
 * `manual`: keep existing transit fields; only fill missing from place-level transit on default origin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultOriginId, haversineKm, syncLegacyRoutes } from "./lib/routes.mjs";
import { fetchNearestStations, fetchTflJourney, formatHotelTransit } from "./lib/transit-providers/tfl.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const force = args.includes("--force");
let originFilter = null;
let journeyDate = null;
let journeyTime = "1100";
let dryHotelOnly = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--origin") originFilter = args[++i];
  if (args[i] === "--date") journeyDate = args[++i];
  if (args[i] === "--time") journeyTime = args[++i];
  if (args[i] === "--hotel-stations-only") dryHotelOnly = true;
}

const cityFile = args.find((a) => a.endsWith(".json") && !a.startsWith("--"));
if (!cityFile) {
  console.error(`Usage: node scripts/enrich-transit.mjs <city.json> [--force] [--origin id] [--date YYYYMMDD] [--time HHmm]`);
  process.exit(1);
}

const absCity = path.isAbsolute(cityFile) ? cityFile : path.join(root, cityFile);
const city = JSON.parse(fs.readFileSync(absCity, "utf8"));
const provider = city.routing?.transit ?? "none";

if (provider === "none") {
  console.log("routing.transit is none — skipped");
  process.exit(0);
}

const defaultId = defaultOriginId(city);
const origins = city.origins?.length
  ? city.origins
  : [{ id: "hotel", lat: city.hotel.lat, lng: city.hotel.lng }];
const targets = originFilter ? origins.filter((o) => o.id === originFilter) : origins;

function weekdayDateFromStay() {
  const d = city.hotel?.stay?.check_in;
  if (d) return d.replace(/-/g, "");
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

const date = journeyDate || weekdayDateFromStay();
const time = journeyTime;

const cachePath = path.join(root, "data/cache/transit-tfl.json");
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};
const delayMs = Number(process.env.TFL_DELAY_MS || 350);

async function runTfl() {
  if (!dryHotelOnly) {
    const all = [...city.places, ...city.events];
    for (const origin of targets) {
      for (const p of all) {
        if (p.lat == null || p.lng == null) continue;
        if (!p.routes) p.routes = {};
        const kmApart = haversineKm(origin, p);
        if (kmApart < 0.08) {
          const atVenue = {
            min: 0,
            description: "На площадке",
            description_en: "At the venue",
            mode: "walking",
          };
          p.routes[origin.id] = { ...p.routes[origin.id], transit: atVenue };
          if (origin.id === defaultId) syncLegacyRoutes(p, defaultId);
          console.log("transit", origin.id, "→", p.id, "at venue");
          continue;
        }
        if (!force && p.routes[origin.id]?.transit?.description_en) {
          console.log("skip", origin.id, p.id, "(cached in city file)");
          continue;
        }
        try {
          const { transit } = await fetchTflJourney(
            { lat: origin.lat, lng: origin.lng },
            { lat: p.lat, lng: p.lng },
            { date, time, cache, cachePath, delayMs },
          );
          p.routes[origin.id] = { ...p.routes[origin.id], transit };
          if (origin.id === defaultId) syncLegacyRoutes(p, defaultId);
          console.log("transit", origin.id, "→", p.id, transit.min, "min");
        } catch (e) {
          console.error("fail", origin.id, p.id, e.message);
        }
      }
    }
  }

  try {
    const { names, lines } = await fetchNearestStations(city.hotel.lat, city.hotel.lng);
    const ht = formatHotelTransit(names, lines);
    if (ht.transit_description_en) {
      city.hotel.transit_description = ht.transit_description;
      city.hotel.transit_description_en = ht.transit_description_en;
      console.log("hotel stations:", ht.transit_description_en);
    }
  } catch (e) {
    console.warn("hotel StopPoint:", e.message);
  }

  fs.writeFileSync(absCity, JSON.stringify(city, null, 2) + "\n");
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
  console.log("wrote", absCity, "provider=tfl", `date=${date} time=${time}`);
}

if (provider === "manual") {
  console.log("manual mode — no API; ensure transit is set in JSON");
  process.exit(0);
}

if (provider === "tfl") {
  await runTfl();
} else {
  console.error("Unknown routing.transit:", provider);
  process.exit(1);
}
