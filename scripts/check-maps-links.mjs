#!/usr/bin/env node
/**
 * Validate Google Maps outbound links for every place/event/hotel/origin.
 * Usage: node scripts/check-maps-links.mjs [--resolve] [--city slug]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCanonicalMapsUrl,
  hasForbiddenMapsPattern,
  validateOutboundMapsUrl,
  validatePlaceMapsLink,
} from "../lib/google-maps-links.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const resolve = process.argv.includes("--resolve");
let cityArg = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--city") cityArg = process.argv[++i];
}

const errors = [];
let checked = 0;

async function followCid(url) {
  if (!resolve || !url?.includes("cid=")) return null;
  try {
    const res = await fetch(url, { redirect: "follow", method: "GET" });
    const final = res.url || url;
    if (!final.includes("/maps/place") && !final.includes("google.com/maps")) {
      return `cid redirect did not land on /maps/place: ${final}`;
    }
  } catch (e) {
    return `cid resolve failed: ${e.message}`;
  }
  return null;
}

function checkRow(row, label, cityName) {
  checked++;
  const mapsOut = row.maps_url || row.google_maps_url;
  if (!mapsOut) {
    errors.push(`${label}: missing maps_url`);
    return;
  }
  errors.push(...validateOutboundMapsUrl(mapsOut, label));
  if (row.id || row.name) {
    errors.push(...validatePlaceMapsLink({ ...row, id: label, maps_url: mapsOut }, cityName));
  }
  for (const u of [mapsOut, row.google?.maps_url]) {
    if (u) errors.push(...validateOutboundMapsUrl(u, label));
    if (hasForbiddenMapsPattern(u)) errors.push(`${label}: forbidden /g/ in place_id param`);
  }
  const g = row.google;
  if (g) {
    const canonical = buildCanonicalMapsUrl(g, {
      name: row.name || row.label_en || row.label_ru,
      name_en: row.name_en || row.label_en,
      address: row.address,
      cityName,
      lat: row.lat,
      lng: row.lng,
    });
    const out = mapsOut;
    if (out && canonical !== out) {
      errors.push(`${label}: stored URL != canonical (${out} vs ${canonical})`);
    }
  }
}

async function checkFile(file) {
  const city = JSON.parse(fs.readFileSync(file, "utf8"));
  const cityName = city.name_en || city.name_ru || city.slug;
  checkRow(city.hotel, "hotel", cityName);
  if (resolve && city.hotel?.maps_url?.includes("cid=")) {
    const err = await followCid(city.hotel.maps_url);
    if (err) errors.push(`hotel: ${err}`);
  }
  for (const o of city.origins || []) checkRow({ ...o, name: o.label_en }, `origin:${o.id}`, cityName);
  for (const p of city.places || []) {
    checkRow(p, p.id, cityName);
    if (resolve && p.maps_url?.includes("cid=")) {
      const err = await followCid(p.maps_url);
      if (err) errors.push(`${p.id}: ${err}`);
    }
  }
  for (const e of city.events || []) checkRow(e, e.id, cityName);
}

const citiesDir = path.join(root, "data/cities");
const files = fs
  .readdirSync(citiesDir)
  .filter((f) => f.endsWith(".json") && (!cityArg || f === `${cityArg}.json`));

for (const f of files) await checkFile(path.join(citiesDir, f));

const demoRoot = path.join(root, "demo");
if (fs.existsSync(demoRoot)) {
  for (const dir of fs.readdirSync(demoRoot)) {
    if (cityArg && dir !== cityArg) continue;
    const jsonPath = path.join(demoRoot, dir, `${dir}.json`);
    if (fs.existsSync(jsonPath)) await checkFile(jsonPath);
  }
}

console.log(`checked ${checked} entities, ${errors.length} error(s)`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log("check-maps-links OK");