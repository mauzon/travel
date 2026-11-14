#!/usr/bin/env node
/**
 * Set which origin is default for sorting and legacy route sync.
 * Usage: node scripts/set-default-origin.mjs --city <slug> --id <origin-id>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const get = (f) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const citySlug = get("--city");
const id = get("--id");

if (!citySlug || !id) {
  console.error("Usage: node scripts/set-default-origin.mjs --city <slug> --id <origin-id>");
  process.exit(1);
}

const file = path.join(root, "data/cities", `${citySlug}.json`);
const city = JSON.parse(fs.readFileSync(file, "utf8"));
if (!city.origins?.some((o) => o.id === id)) {
  console.error("Origin not found:", id);
  process.exit(1);
}
for (const o of city.origins) {
  if (o.id === id) o.default = true;
  else delete o.default;
}
fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
console.log("default origin set to", id);
