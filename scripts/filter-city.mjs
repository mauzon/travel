#!/usr/bin/env node
/**
 * Filter extracted list items by radius or bbox around a center.
 * Usage:
 *   node scripts/filter-city.mjs list.json --lat 13.73 --lng 100.54 --radius-km 80
 *   node scripts/filter-city.mjs list.json --bbox 18.5,98.8,19.2,99.3
 */
import fs from "node:fs";

function parseArgs(argv) {
  const opts = { file: argv[2] };
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--lat") opts.lat = Number(argv[++i]);
    else if (argv[i] === "--lng") opts.lng = Number(argv[++i]);
    else if (argv[i] === "--radius-km") opts.radiusKm = Number(argv[++i]);
    else if (argv[i] === "--bbox") {
      const [s, w, n, e] = argv[++i].split(",").map(Number);
      opts.bbox = { south: s, west: w, north: n, east: e };
    }
  }
  return opts;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const opts = parseArgs(process.argv);
const data = JSON.parse(fs.readFileSync(opts.file, "utf8"));
const items = data.items || data;

let filtered = items.filter((it) => it.lat != null && it.lng != null);
if (opts.bbox) {
  const { south, west, north, east } = opts.bbox;
  filtered = filtered.filter((it) => it.lat >= south && it.lat <= north && it.lng >= west && it.lng <= east);
} else if (opts.lat != null && opts.lng != null && opts.radiusKm != null) {
  const center = { lat: opts.lat, lng: opts.lng };
  filtered = filtered
    .map((it) => ({ ...it, _km: haversineKm(center, it) }))
    .filter((it) => it._km <= opts.radiusKm);
} else {
  console.error("Provide --lat --lng --radius-km or --bbox");
  process.exit(1);
}

process.stdout.write(JSON.stringify({ count: filtered.length, items: filtered }, null, 2) + "\n");
