#!/usr/bin/env node
/**
 * Attach a Google Maps list URL to a city bundle (metadata only).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
const url = process.argv[3] || "";

if (!slug) {
  console.error("Usage: node scripts/add-city-source-meta.mjs <slug> [list-url]");
  process.exit(1);
}

const file = path.join(root, "data/cities", `${slug}.json`);
const city = JSON.parse(fs.readFileSync(file, "utf8"));
if (url) {
  if (!city.sources.includes(url)) city.sources.unshift(url);
  city.source = { ...(city.source || {}), list_url: url };
}
fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
console.log("updated", file);
