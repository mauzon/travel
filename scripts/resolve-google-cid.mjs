#!/usr/bin/env node
/**
 * Resolve Google Maps feature id + CID via browser search at known coordinates.
 * Usage: node scripts/resolve-google-cid.mjs --json path/to/city.json [--write] [--ids a,b]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  featureIdToCid,
  ingestMapsIdentity,
  parseFeatureIdFromText,
} from "../lib/google-maps-links.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
let jsonPath = null;
let onlyIds = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--json") jsonPath = process.argv[++i];
  else if (process.argv[i] === "--ids") onlyIds = new Set(process.argv[++i].split(","));
}

if (!jsonPath) {
  console.error("Usage: node scripts/resolve-google-cid.mjs --json <city.json> [--write] [--ids id1,id2]");
  process.exit(1);
}
jsonPath = path.resolve(jsonPath);
const city = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const cityName = city.name_en || city.name_ru || city.slug;

function distM(a, b) {
  if (a.lat == null || b.lat == null) return Infinity;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function searchQuery(row, cityName) {
  return [row.name || row.label_en || row.label_ru, row.address, cityName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function targets(city) {
  const rows = [];
  rows.push({ key: "hotel", row: city.hotel, lat: city.hotel.lat, lng: city.hotel.lng });
  for (const o of city.origins || []) {
    rows.push({ key: `origin:${o.id}`, row: { ...o, name: o.label_en }, lat: o.lat, lng: o.lng });
  }
  for (const p of city.places || []) {
    rows.push({ key: p.id, row: p, lat: p.lat, lng: p.lng });
  }
  for (const e of city.events || []) {
    rows.push({ key: e.id, row: e, lat: e.lat, lng: e.lng });
  }
  return rows.filter((t) => !onlyIds || onlyIds.has(t.key) || onlyIds.has(t.row.id));
}

const list = targets(city);
const browser = await chromium.launch();
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  locale: "en-GB",
});
const consent = async () => {
  const btn = page.locator("button", { hasText: /Accept all|I agree|Accept/i }).first();
  if (await btn.count()) await btn.click({ timeout: 2000 }).catch(() => {});
};

const results = { resolved: 0, failed: [], items: {} };

for (const t of list) {
  const q = searchQuery(t.row, cityName);
  if (t.lat == null || t.lng == null) {
    results.failed.push({ key: t.key, reason: "missing coords" });
    continue;
  }
  const slug = encodeURIComponent(q).replace(/%20/g, "+");
  const url = `https://www.google.com/maps/search/${slug}/@${t.lat},${t.lng},16z`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await consent();
    let finalUrl = page.url();
    let feat = null;
    for (let attempt = 0; attempt < 18; attempt++) {
      await page.waitForTimeout(1000);
      finalUrl = page.url();
      feat = parseFeatureIdFromText(finalUrl);
      if (feat?.cid) break;
      if (attempt === 4) {
        const feed = page.locator('[role="feed"] > div > a, [role="feed"] > div').first();
        if (await feed.count()) await feed.click({ timeout: 3000 }).catch(() => {});
      }
    }
    if (!feat?.cid) feat = parseFeatureIdFromText(await page.content());
    if (!feat?.cid) {
      results.failed.push({ key: t.key, reason: "no feature id", url: finalUrl.slice(0, 120) });
      continue;
    }
    const m = finalUrl.match(/!8m2!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (m) {
      const d = distM({ lat: t.lat, lng: t.lng }, { lat: Number(m[1]), lng: Number(m[2]) });
      if (d > 500) {
        results.failed.push({ key: t.key, reason: `coords mismatch ${Math.round(d)}m`, cid: feat.cid });
        continue;
      }
    }
    results.items[t.key] = { feature_id: feat.feature_id, cid: feat.cid, query: q, maps_place_url: finalUrl.split("?")[0] };
    results.resolved++;
    console.log(`✓ ${t.key} cid=${feat.cid}`);
  } catch (e) {
    results.failed.push({ key: t.key, reason: e.message });
  }
  await page.waitForTimeout(800);
}

await browser.close();

if (write) {
  const apply = (row, item) => {
    row.google = { ...(row.google || {}), cid: item.cid, feature_id: item.feature_id };
    if (item.maps_place_url?.includes("/maps/place")) row.google.maps_url = item.maps_place_url;
    const ingested = ingestMapsIdentity(row, cityName);
    row.maps_url = ingested.maps_url;
    row.google = ingested.google;
    if (ingested.google?.place_id) row.maps_place_id = ingested.google.place_id;
  };

  if (results.items.hotel) apply(city.hotel, results.items.hotel);
  for (const o of city.origins || []) {
    const k = `origin:${o.id}`;
    if (results.items[k]) {
      const item = results.items[k];
      o.google = { ...(o.google || {}), cid: item.cid, feature_id: item.feature_id };
      const ing = ingestMapsIdentity(
        { name: o.label_en, lat: o.lat, lng: o.lng, google: o.google, maps_url: o.google_maps_url },
        cityName,
      );
      o.google = ing.google;
      o.google_maps_url = ing.maps_url;
    }
  }
  for (const p of city.places || []) {
    if (results.items[p.id]) apply(p, results.items[p.id]);
  }
  for (const e of city.events || []) {
    if (results.items[e.id]) apply(e, results.items[e.id]);
  }
  fs.writeFileSync(jsonPath, JSON.stringify(city, null, 2) + "\n");
}

console.log(JSON.stringify(results, null, 2));
if (results.failed.length && !write) process.exitCode = 1;