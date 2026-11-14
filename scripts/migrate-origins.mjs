#!/usr/bin/env node
/**
 * Migrate city.hotel into origins[] and place.routes.{hotel}.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultOriginId, syncLegacyRoutes } from "./lib/routes.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data/cities");

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const fp = path.join(dir, file);
  const city = JSON.parse(fs.readFileSync(fp, "utf8"));
  const h = city.hotel;
  if (!h?.lat) {
    console.warn("skip (no hotel)", file);
    continue;
  }
  if (!city.origins?.length) {
    city.origins = [
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
  const oid = defaultOriginId(city);
  for (const p of [...city.places, ...city.events]) {
    if (!p.routes) p.routes = {};
    if (!p.routes[oid] && (p.walk || p.taxi || p.sort_km != null)) {
      p.routes[oid] = {
        walk: p.walk,
        taxi: p.taxi,
        transit: p.transit,
        sort_km: p.sort_km,
      };
    }
    syncLegacyRoutes(p, oid);
  }
  fs.writeFileSync(fp, JSON.stringify(city, null, 2) + "\n");
  console.log("migrated", file, "origins:", city.origins.length);
}
