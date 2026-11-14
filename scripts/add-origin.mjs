#!/usr/bin/env node
/**
 * Add a reference point (origin) to a city and enrich routes for it.
 *
 * Usage:
 *   npm run add-origin -- --city bangkok --id qsncc --label-ru "QSNCC" --label-en "QSNCC" \\
 *     --kind venue --lat 13.7235 --lng 100.5583
 *   npm run add-origin -- --city bangkok --id qsncc --label-ru "..." --label-en "..." \\
 *     --maps-url "https://www.google.com/maps/search/?api=1&query=...@13.72,100.55"
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ingestMapsIdentity,
  isPreservedSourceMapsUrl,
  mergeGoogleFields,
  parseUrlIntoGoogleFields,
} from "../lib/google-maps-links.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const get = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const citySlug = get("--city");
const id = get("--id");
const labelRu = get("--label-ru");
const labelEn = get("--label-en");
const kind = get("--kind") || "venue";
const latArg = get("--lat");
const lngArg = get("--lng");
const mapsUrl = get("--maps-url") || get("--google-maps-url");
const makeDefault = argv.includes("--default");

if (!citySlug || !id || !labelRu || !labelEn) {
  console.error(`Usage:
  npm run add-origin -- --city <slug> --id <id> --label-ru "..." --label-en "..."
    [--kind hotel|venue|other] [--lat N --lng E] [--maps-url URL] [--default]

Then runs enrich-routes for the new origin.`);
  process.exit(1);
}

function parseCoords(url) {
  if (!url) return null;
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const q = url.match(/query=[^@]+@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]) };
  return null;
}

let lat = latArg != null ? Number(latArg) : null;
let lng = lngArg != null ? Number(lngArg) : null;
if ((lat == null || lng == null) && mapsUrl) {
  const c = parseCoords(mapsUrl);
  if (c) {
    lat = c.lat;
    lng = c.lng;
  }
}
if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
  console.error("Need --lat and --lng or a Google Maps URL with coordinates.");
  process.exit(1);
}

const file = path.join(root, "data/cities", `${citySlug}.json`);
if (!fs.existsSync(file)) {
  console.error("City not found:", file);
  process.exit(1);
}

const city = JSON.parse(fs.readFileSync(file, "utf8"));
if (!city.origins) city.origins = [];
if (city.origins.some((o) => o.id === id)) {
  console.error("Origin id already exists:", id);
  process.exit(1);
}

const cityName = city.name_en || city.name_ru || citySlug;
let google_maps_url;
let google;
if (mapsUrl) {
  const g = mergeGoogleFields({}, parseUrlIntoGoogleFields(mapsUrl));
  if (isPreservedSourceMapsUrl(mapsUrl)) g.maps_url = mapsUrl;
  const ingested = ingestMapsIdentity(
    { name: labelEn, name_en: labelEn, lat, lng, maps_url: mapsUrl, google: g },
    cityName,
  );
  google_maps_url = ingested.maps_url;
  google = ingested.google;
}

if (makeDefault) city.origins.forEach((o) => delete o.default);
city.origins.push({
  id,
  label_ru: labelRu,
  label_en: labelEn,
  kind,
  ...(makeDefault ? { default: true } : {}),
  lat,
  lng,
  ...(google_maps_url ? { google_maps_url } : {}),
  ...(google ? { google } : {}),
});

fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
console.log("added origin", id, "to", citySlug);

const enrich = path.join(root, "scripts/enrich-routes.mjs");
await new Promise((resolve, reject) => {
  const proc = spawn("node", [enrich, file, "--force", "--origin", id], {
    cwd: root,
    stdio: "inherit",
  });
  proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("enrich failed"))));
});
