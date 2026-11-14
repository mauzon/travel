#!/usr/bin/env node
/**
 * Recompute google.* fields and canonical maps_url for city + demo JSON.
 * Usage: node scripts/fix-maps-links.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ingestMapsIdentity } from "../lib/google-maps-links.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

const stats = {
  cities: 0,
  places_fixed: 0,
  events_fixed: 0,
  hotels_fixed: 0,
  origins_fixed: 0,
  with_cid: 0,
  with_place_id: 0,
  with_preserved_url: 0,
  unresolved: 0,
};

function fixEntity(row, cityName, kind) {
  const before = row.maps_url;
  const { google, maps_url } = ingestMapsIdentity(row, cityName);
  row.google = Object.keys(google).length ? google : undefined;
  if (google.cid) stats.with_cid++;
  if (google.place_id) stats.with_place_id++;
  if (google.maps_url) stats.with_preserved_url++;
  if (!google.cid && !google.place_id && !google.maps_url) stats.unresolved++;

  row.maps_url = maps_url;
  if (google.place_id) row.maps_place_id = google.place_id;
  else if (row.maps_place_id && !google.mid) {
    delete row.maps_place_id;
  }

  if (before !== maps_url || row.google) {
    if (kind === "place") stats.places_fixed++;
    else if (kind === "event") stats.events_fixed++;
    else if (kind === "hotel") stats.hotels_fixed++;
    else if (kind === "origin") stats.origins_fixed++;
  }
}

function fixCityFile(file) {
  const city = JSON.parse(fs.readFileSync(file, "utf8"));
  const cityName = city.name_en || city.name_ru || city.slug;
  fixEntity(city.hotel, cityName, "hotel");
  for (const o of city.origins || []) {
    const row = {
      name: o.label_en || o.label_ru,
      maps_url: o.google_maps_url,
      lat: o.lat,
      lng: o.lng,
      google: o.google,
    };
    fixEntity(row, cityName, "origin");
    o.google_maps_url = row.maps_url;
    o.google = row.google;
  }
  for (const p of city.places || []) fixEntity(p, cityName, "place");
  for (const e of city.events || []) fixEntity(e, cityName, "event");
  stats.cities++;
  if (write) fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
  return city;
}

const cityFiles = fs.readdirSync(path.join(root, "data/cities")).filter((f) => f.endsWith(".json"));
for (const f of cityFiles) fixCityFile(path.join(root, "data/cities", f));

const demoRoot = path.join(root, "demo");
if (fs.existsSync(demoRoot)) {
  for (const dir of fs.readdirSync(demoRoot)) {
    const jsonPath = path.join(demoRoot, dir, `${dir}.json`);
    if (fs.existsSync(jsonPath)) fixCityFile(jsonPath);
  }
}

console.log(JSON.stringify({ write, ...stats }, null, 2));
if (!write) console.error("Dry run — pass --write to update files");