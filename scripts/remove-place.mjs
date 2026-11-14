#!/usr/bin/env node
/**
 * Remove one place or event from a city bundle.
 * Usage: node scripts/remove-place.mjs --city <slug> --id <place-id> [--kind place|event]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const get = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const citySlug = get("--city");
const id = get("--id");
const kind = get("--kind") || "place";

if (!citySlug || !id) {
  console.error("Usage: node scripts/remove-place.mjs --city <slug> --id <id> [--kind place|event]");
  process.exit(1);
}

const file = path.join(root, "data/cities", `${citySlug}.json`);
const city = JSON.parse(fs.readFileSync(file, "utf8"));
const key = kind === "event" ? "events" : "places";
const before = city[key].length;
city[key] = city[key].filter((p) => p.id !== id);
if (city[key].length === before) {
  console.error("No matching", kind, id);
  process.exit(1);
}
fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
console.log("removed", kind, id, "from", citySlug);
