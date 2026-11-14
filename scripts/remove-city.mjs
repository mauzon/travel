#!/usr/bin/env node
/**
 * Remove a city file and update config.json. Optionally prune OSRM cache keys for that city.
 * Usage: node scripts/remove-city.mjs --slug <slug> [--prune-cache]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv.includes("--slug")
  ? process.argv[process.argv.indexOf("--slug") + 1]
  : process.argv[2];
const pruneCache = process.argv.includes("--prune-cache");

if (!slug) {
  console.error("Usage: node scripts/remove-city.mjs --slug <slug> [--prune-cache]");
  process.exit(1);
}

const cityFile = path.join(root, "data/cities", `${slug}.json`);
let cityForCache = null;
if (fs.existsSync(cityFile)) {
  if (pruneCache) {
    try {
      cityForCache = JSON.parse(fs.readFileSync(cityFile, "utf8"));
    } catch {
      /* ignore */
    }
  }
  fs.unlinkSync(cityFile);
}

const configPath = path.join(root, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.cities = (config.cities || []).filter((c) => c.slug !== slug);
if (config.defaultCity === slug) {
  config.defaultCity = config.cities[0]?.slug || "";
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("removed city", slug, "from config and data/cities");

if (pruneCache) {
  const cachePath = path.join(root, "data/cache/osrm.json");
  if (!fs.existsSync(cachePath)) {
    console.log("no osrm cache to prune");
    process.exit(0);
  }
  const city = cityForCache;
  if (!city) {
    console.log("city file was missing; skipped cache prune");
    process.exit(0);
  }
  const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  const coords = new Set();
  for (const o of city.origins || []) coords.add(`${o.lat},${o.lng}`);
  coords.add(`${city.hotel.lat},${city.hotel.lng}`);
  let removed = 0;
  for (const key of Object.keys(cache)) {
    const from = key.split("->")[0];
    if (coords.has(from)) {
      delete cache[key];
      removed++;
    }
  }
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
  console.log("pruned", removed, "osrm cache keys (approximate)");
}
