#!/usr/bin/env node
/**
 * Remove an origin from a city and drop its per-place route entries.
 * Usage: node scripts/remove-origin.mjs --city <slug> --id <origin-id>
 * Optional: --enrich to rerun enrich-routes for remaining origins
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const get = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const citySlug = get("--city");
const id = get("--id");
const doEnrich = argv.includes("--enrich");

if (!citySlug || !id) {
  console.error("Usage: node scripts/remove-origin.mjs --city <slug> --id <id> [--enrich]");
  process.exit(1);
}

const file = path.join(root, "data/cities", `${citySlug}.json`);
const city = JSON.parse(fs.readFileSync(file, "utf8"));
if (!city.origins?.length) {
  console.error("City has no origins array");
  process.exit(1);
}
const next = city.origins.filter((o) => o.id !== id);
if (next.length === city.origins.length) {
  console.error("Origin not found:", id);
  process.exit(1);
}
city.origins = next;
if (!city.origins.some((o) => o.default) && city.origins[0]) {
  city.origins[0].default = true;
}
for (const p of [...city.places, ...city.events]) {
  if (p.routes?.[id]) delete p.routes[id];
}
fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
console.log("removed origin", id);

if (doEnrich) {
  const enrich = path.join(root, "scripts/enrich-routes.mjs");
  await new Promise((resolve, reject) => {
    const proc = spawn("node", [enrich, file, "--force"], { cwd: root, stdio: "inherit" });
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("enrich failed"))));
  });
}
