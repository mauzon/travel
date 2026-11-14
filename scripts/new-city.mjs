#!/usr/bin/env node
/**
 * Scaffold data/cities/<slug>.json and append to config.json
 * Usage: node scripts/new-city.mjs <slug> --name "Ho Chi Minh" --country VN
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const slug = process.argv[2];
  const opts = { slug };
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i] === "--name") opts.name_ru = process.argv[++i];
    else if (process.argv[i] === "--country") opts.country = process.argv[++i];
    else if (process.argv[i] === "--timezone") opts.timezone = process.argv[++i];
    else if (process.argv[i] === "--currency") opts.currency = process.argv[++i];
    else if (process.argv[i] === "--dates") opts.dates = process.argv[++i];
  }
  return opts;
}

const opts = parseArgs();
if (!opts.slug) {
  console.error("Usage: node scripts/new-city.mjs <slug> --name <name_ru> [--country TH] [--dates ...]");
  process.exit(1);
}

const cityPath = path.join(root, "data/cities", `${opts.slug}.json`);
if (fs.existsSync(cityPath)) {
  console.error("City file already exists:", cityPath);
  process.exit(1);
}

const city = {
  slug: opts.slug,
  name_ru: opts.name_ru || opts.slug,
  country: opts.country || "TH",
  timezone: opts.timezone || "Asia/Bangkok",
  currency: opts.currency || "THB",
  hotel: {
    name: "Hotel TBD",
    address: "",
    lat: 0,
    lng: 0,
    maps_url: "https://www.google.com/maps",
    stay: { check_in: "2026-01-01", check_out: "2026-01-02", label: opts.dates || "" },
  },
  transport: {
    taxi: { base_fare_thb: 35, per_km_thb_min: 6, per_km_thb_max: 8, traffic_factor: 1.3 },
    transit_description: "",
  },
  places: [],
  events: [],
  sources: ["https://www.google.com/maps"],
  routing: { drive: "osrm", walk: "haversine_x1.25", walk_speed_kmh: 4.7 },
};

fs.mkdirSync(path.dirname(cityPath), { recursive: true });
fs.writeFileSync(cityPath, JSON.stringify(city, null, 2) + "\n");

const configPath = path.join(root, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!config.cities.some((c) => c.slug === opts.slug)) {
  config.cities.push({
    slug: opts.slug,
    title: opts.name_ru || opts.slug,
    dates: opts.dates || "",
  });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

console.log("created", cityPath);
