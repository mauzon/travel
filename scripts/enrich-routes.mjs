#!/usr/bin/env node
/**
 * Enrich places with walk/taxi per origin using OSRM + fare model.
 * Usage: node scripts/enrich-routes.mjs data/cities/bangkok.json [--force] [--origin id]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRouteBundle,
  cacheKey,
  defaultOriginId,
  syncLegacyRoutes,
} from "./lib/routes.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const force = args.includes("--force");
let originFilter = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--origin") originFilter = args[++i];
}
const cityFile = args.find((a) => a.endsWith(".json") && !a.startsWith("--"));
if (!cityFile) {
  console.error("Usage: node scripts/enrich-routes.mjs <city.json> [--force] [--origin id]");
  process.exit(1);
}

const city = JSON.parse(fs.readFileSync(cityFile, "utf8"));
const cachePath = path.join(root, "data/cache/osrm.json");
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};

const origins = city.origins?.length
  ? city.origins
  : [
      {
        id: "hotel",
        lat: city.hotel.lat,
        lng: city.hotel.lng,
      },
    ];
const targets = originFilter ? origins.filter((o) => o.id === originFilter) : origins;
if (!targets.length) {
  console.error("No matching origin", originFilter);
  process.exit(1);
}
const defaultId = defaultOriginId(city);

async function osrmDrive(lat1, lng1, lat2, lng2) {
  const key = cacheKey(lat1, lng1, lat2, lng2);
  if (cache[key] && !force) return cache[key];
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "pinkeepr/1.0 (mauzon/pinkeepr)" } });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const json = await res.json();
      const route = json.routes?.[0];
      if (!route) throw new Error("no route");
      const entry = { distance_m: Math.round(route.distance), duration_s: Math.round(route.duration), seeded: false };
      cache[key] = entry;
      return entry;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

const all = [...city.places, ...city.events];
for (const origin of targets) {
  for (const p of all) {
    if (p.lat == null || p.lng == null) continue;
    if (!p.routes) p.routes = {};
    if (!force && p.routes[origin.id]?.taxi?.km) continue;
    try {
      const key = cacheKey(origin.lat, origin.lng, p.lat, p.lng);
      let drive = cache[key];
      if (!drive) drive = await osrmDrive(origin.lat, origin.lng, p.lat, p.lng);
      const existingTransit = p.routes[origin.id]?.transit;
      const ru = buildRouteBundle(origin, p, drive, city, "ru");
      const enBundle = buildRouteBundle(origin, p, drive, city, "en");
      if (ru.walk) ru.walk.label_en = enBundle.walk.label;
      if (ru.taxi) ru.taxi.label_en = enBundle.taxi.label;
      if (existingTransit) ru.transit = existingTransit;
      else if (origin.id === defaultId && p.transit) ru.transit = p.transit;
      p.routes[origin.id] = ru;
      if (origin.id === defaultId) syncLegacyRoutes(p, defaultId);
    } catch (e) {
      console.error("skip", origin.id, p.name, e.message);
    }
  }
}

fs.writeFileSync(cityFile, JSON.stringify(city, null, 2) + "\n");
fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
console.log("enriched", cityFile, "origins:", targets.map((o) => o.id).join(", "));
