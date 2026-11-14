#!/usr/bin/env node
/**
 * Load, remove, or clear demo data packs (local name or https URL).
 *
 * Usage:
 *   node scripts/demo.mjs <pack-id|https-url>
 *   node scripts/demo.mjs remove <pack-id>
 *   node scripts/demo.mjs clear
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearAll,
  loadPackFromDir,
  loadPackFromUrl,
  packValidator,
  readManifestOnly,
  removePackByManifest,
  resolvePackUrls,
} from "./lib/demo-pack.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const validate = packValidator(root);

const [cmd, arg] = process.argv.slice(2);

function usage() {
  console.error(`Usage:
  npm run demo -- <pack-id>           # e.g. london, example (demo/<id>/pack.json)
  npm run demo -- <https-pack-url>    # GitHub tree/blob/raw link to a pack
  npm run demo -- remove <pack-id>    # drop cities/files from a local pack manifest
  npm run demo -- clear               # reset config and delete all city JSON`);
  process.exit(1);
}

if (!cmd) usage();

if (cmd === "clear") {
  clearAll(root);
  console.log("Cleared all city data and reset config.json");
  process.exit(0);
}

if (cmd === "remove") {
  if (!arg) usage();
  const manifest = readManifestOnly(arg, root, validate);
  removePackByManifest(manifest, root);
  console.log(`Removed pack "${manifest.id}" from data/cities and config.json`);
  process.exit(0);
}

const target = cmd;
const isUrl = /^https:\/\//i.test(target);

try {
  let manifest;
  if (isUrl) {
    manifest = await loadPackFromUrl(target, root, validate);
    const { manifestUrl } = resolvePackUrls(target);
    console.log(`Loaded pack "${manifest.id}" from ${manifestUrl}`);
  } else {
    const packDir = path.join(root, "demo", target);
    if (!fs.existsSync(path.join(packDir, "pack.json"))) {
      console.error(`Unknown pack "${target}" — expected ${packDir}/pack.json`);
      process.exit(1);
    }
    manifest = loadPackFromDir(packDir, root, validate);
    console.log(`Loaded pack "${manifest.id}" from demo/${target}/`);
  }
  console.log(`Cities: ${manifest.cityIds.join(", ")}; files: ${manifest.files.map((f) => f.target).join(", ")}`);
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
