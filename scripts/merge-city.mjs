#!/usr/bin/env node
/**
 * Merge extracted/filtered places, manual additions and events into data/cities/<slug>.json
 * Usage: node scripts/merge-city.mjs --city bangkok --places places.json [--events events.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ingestMapsIdentity,
  isRealPlaceId,
  mergeGoogleFields,
  parseUrlIntoGoogleFields,
  placeIdFromUrl,
} from "../lib/google-maps-links.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const opts = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--city") opts.city = process.argv[++i];
    else if (a === "--places") opts.places = process.argv[++i];
    else if (a === "--events") opts.events = process.argv[++i];
  }
  return opts;
}

function distM(a, b) {
  if (!a.lat || !b.lat) return Infinity;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function matchExisting(existing, incoming) {
  const inPid =
    incoming.google?.place_id ||
    (isRealPlaceId(incoming.maps_place_id) ? incoming.maps_place_id : null) ||
    placeIdFromUrl(incoming.maps_url);
  const inCid = incoming.google?.cid || incoming.cid;
  for (const e of existing) {
    const ePid =
      e.google?.place_id ||
      (isRealPlaceId(e.maps_place_id) ? e.maps_place_id : null) ||
      placeIdFromUrl(e.maps_url);
    const eCid = e.google?.cid;
    if (inPid && ePid && inPid === ePid) return e;
    if (inCid && eCid && inCid === eCid) return e;
    if (e.name === incoming.name && distM(e, incoming) < 100) return e;
  }
  return null;
}

function slugId(name, google) {
  if (google?.cid) return `cid-${google.cid}`;
  if (google?.place_id && isRealPlaceId(google.place_id)) {
    return google.place_id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  }
  return name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").slice(0, 80);
}

const opts = parseArgs();
if (!opts.city || !opts.places) {
  console.error("Usage: node scripts/merge-city.mjs --city <slug> --places <file.json> [--events <file.json>]");
  process.exit(1);
}

const cityPath = path.join(root, "data/cities", `${opts.city}.json`);
const city = JSON.parse(fs.readFileSync(cityPath, "utf8"));
const placesIn = JSON.parse(fs.readFileSync(opts.places, "utf8"));
const newPlaces = placesIn.items || placesIn.places || placesIn;

let merged = 0;
const cityName = city.name_en || city.name_ru || opts.city;

for (const raw of newPlaces) {
  const google = mergeGoogleFields(raw.google, parseUrlIntoGoogleFields(raw.maps_url || raw.maps));
  if (raw.cid) google.cid = String(raw.cid);
  if (raw.place_id && isRealPlaceId(raw.place_id)) google.place_id = raw.place_id;
  const ingested = ingestMapsIdentity(
    {
      name: raw.name_ru || raw.name,
      name_en: raw.name_en,
      address: raw.address,
      lat: raw.lat,
      lng: raw.lng,
      maps_url: raw.maps_url || raw.maps,
      google,
    },
    cityName,
  );
  const incoming = {
    id: slugId(raw.name_ru || raw.name, ingested.google),
    name: raw.name_ru || raw.name,
    category: raw.category || raw.cat || "sights",
    source: raw.source || "list",
    user_note: raw.note || raw.user_note || undefined,
    lat: raw.lat,
    lng: raw.lng,
    maps_url: ingested.maps_url,
    google: ingested.google,
    maps_place_id: ingested.google?.place_id,
    sort_km: raw.sort_km ?? 9999,
  };
  if (!matchExisting(city.places, incoming)) {
    city.places.push(incoming);
    merged++;
  }
}

if (opts.events) {
  const evIn = JSON.parse(fs.readFileSync(opts.events, "utf8"));
  const events = evIn.items || evIn.events || evIn;
  for (const raw of events) {
    const google = mergeGoogleFields(raw.google, parseUrlIntoGoogleFields(raw.maps_url));
    const ingested = ingestMapsIdentity({ ...raw, google, maps_url: raw.maps_url }, cityName);
    const incoming = {
      ...raw,
      id: raw.id || slugId(raw.name, ingested.google),
      maps_url: ingested.maps_url,
      google: ingested.google,
      category: "events",
      source: "event",
    };
    if (!matchExisting(city.events, incoming)) {
      city.events.push(incoming);
      merged++;
    }
  }
}

fs.writeFileSync(cityPath, JSON.stringify(city, null, 2) + "\n");
console.log(`merged ${merged} new rows into ${opts.city}`);
