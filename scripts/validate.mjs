import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { collectHttpViolations } from "./lib/https-urls.mjs";
import {
  hasForbiddenMapsPattern,
  isKnowledgeGraphMid,
  isRealPlaceId,
} from "../lib/google-maps-links.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "data/schema/city.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const hasCyrillic = (s) => /[А-Яа-яЁё]/.test(s || "");

const citiesDir = path.join(root, "data/cities");
const files = fs.readdirSync(citiesDir).filter((f) => f.endsWith(".json"));
let failed = false;
let warnCount = 0;

if (!files.length) {
  console.log("✓ no city files (empty template)");
}

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(citiesDir, file), "utf8"));
  if (!validate(data)) {
    failed = true;
    console.error(`✗ ${file}`);
    console.error(validate.errors);
    continue;
  }

  const httpBad = collectHttpViolations(data, file);
  if (httpBad.length) {
    failed = true;
    console.error(`✗ ${file} — non-https URL(s)`);
    for (const b of httpBad) console.error(`  - ${b.field}: ${b.url}`);
    continue;
  }

  const mapsErrors = [];
  const forbid = (url, label) => {
    if (url && hasForbiddenMapsPattern(url)) mapsErrors.push(`${label}: forbidden place_id:/g/ pattern`);
  };
  forbid(data.hotel?.maps_url, "hotel.maps_url");
  if (data.hotel?.google?.place_id && !isRealPlaceId(data.hotel.google.place_id)) {
    mapsErrors.push("hotel.google.place_id invalid");
  }
  for (const o of data.origins || []) forbid(o.google_maps_url, `origins.${o.id}`);
  for (const row of [...data.places, ...data.events]) {
    forbid(row.maps_url, row.id);
    if (row.maps_place_id && isKnowledgeGraphMid(row.maps_place_id)) {
      mapsErrors.push(`${row.id}: maps_place_id must not be a /g/ MID (use google.mid)`);
    }
    if (row.google?.place_id && !isRealPlaceId(row.google.place_id)) {
      mapsErrors.push(`${row.id}: google.place_id invalid`);
    }
    if (row.google?.mid && !isKnowledgeGraphMid(row.google.mid)) {
      mapsErrors.push(`${row.id}: google.mid malformed`);
    }
  }
  if (mapsErrors.length) {
    failed = true;
    console.error(`✗ ${file} — maps link rules`);
    for (const e of mapsErrors) console.error(`  - ${e}`);
    continue;
  }

  const warnings = [];
  if (!data.name_en) warnings.push("city.name_en missing");
  if (!data.ui?.summary_en) warnings.push("ui.summary_en missing");

  for (const p of [...data.places, ...data.events]) {
    const ruName = p.name_ru || p.name;
    if (hasCyrillic(ruName) && !p.name_en) warnings.push(`missing name_en: ${p.id}`);
    if (p.description && hasCyrillic(p.description) && !p.description_en && p.source !== "list") {
      warnings.push(`missing description_en: ${p.id}`);
    }
    if (p.schedule_text && hasCyrillic(p.schedule_text) && !p.schedule_en) {
      warnings.push(`missing schedule_en: ${p.id}`);
    }
    if (p.transit?.description && hasCyrillic(p.transit.description) && !p.transit.description_en) {
      warnings.push(`missing transit.description_en: ${p.id}`);
    }
  }

  if (warnings.length) {
    warnCount += warnings.length;
    console.warn(`⚠ ${file} (${warnings.length} translation warnings)`);
    for (const w of warnings.slice(0, 8)) console.warn(`  - ${w}`);
    if (warnings.length > 8) console.warn(`  ... +${warnings.length - 8} more`);
  } else {
    console.log(`✓ ${file} (${data.places.length} places, ${data.events.length} events)`);
  }
}

if (failed) process.exit(1);
if (warnCount) console.warn(`Translation warnings total: ${warnCount} (non-fatal)`);

const packSchema = JSON.parse(
  fs.readFileSync(path.join(root, "data/schema/pack.schema.json"), "utf8"),
);
const validatePack = ajv.compile(packSchema);
const demoRoot = path.join(root, "demo");
if (fs.existsSync(demoRoot)) {
  for (const dir of fs.readdirSync(demoRoot)) {
    const manifestPath = path.join(demoRoot, dir, "pack.json");
    if (!fs.existsSync(manifestPath)) continue;
    const pack = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!validatePack(pack)) {
      console.error(`✗ demo/${dir}/pack.json`);
      console.error(validatePack.errors);
      process.exit(1);
    }
    console.log(`✓ pack demo/${dir}`);
  }
}

const instSchemaPath = path.join(root, "data/schema/instance.schema.json");
const instanceExample = path.join(root, ".travel/instance.example.json");
const instanceLive = path.join(root, ".travel/instance.json");
if (fs.existsSync(instSchemaPath) && (fs.existsSync(instanceExample) || fs.existsSync(instanceLive))) {
  const instSchema = JSON.parse(fs.readFileSync(instSchemaPath, "utf8"));
  const validateInst = ajv.compile(instSchema);
  if (fs.existsSync(instanceExample)) {
    const inst = JSON.parse(fs.readFileSync(instanceExample, "utf8"));
    if (!validateInst(inst)) {
      console.error("✗ .travel/instance.example.json");
      console.error(validateInst.errors);
      process.exit(1);
    }
    console.log("✓ instance example");
  }
  if (fs.existsSync(instanceLive)) {
    const inst = JSON.parse(fs.readFileSync(instanceLive, "utf8"));
    if (!validateInst(inst)) {
      console.error("✗ .travel/instance.json");
      console.error(validateInst.errors);
      process.exit(1);
    }
    console.log("✓ instance state");
  }
}
