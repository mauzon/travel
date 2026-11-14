#!/usr/bin/env node
/**
 * Manage .travel/instance.json (no secrets). Schema: data/schema/instance.schema.json
 *
 * Usage:
 *   node scripts/instance.mjs init
 *   node scripts/instance.mjs show
 *   node scripts/instance.mjs set repository.url "https://github.com/u/r"
 *   node scripts/instance.mjs merge <json-file>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const travelDir = path.join(root, ".travel");
const instancePath = path.join(travelDir, "instance.json");
const examplePath = path.join(travelDir, "instance.example.json");
const schema = JSON.parse(fs.readFileSync(path.join(root, "data/schema/instance.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function load() {
  if (!fs.existsSync(instancePath)) return null;
  const data = JSON.parse(fs.readFileSync(instancePath, "utf8"));
  return data;
}

function save(data) {
  data.updatedAt = new Date().toISOString();
  if (!validate(data)) {
    console.error(validate.errors);
    process.exit(1);
  }
  fs.mkdirSync(travelDir, { recursive: true });
  fs.writeFileSync(instancePath, JSON.stringify(data, null, 2) + "\n");
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "init") {
  if (fs.existsSync(instancePath)) {
    console.log("instance.json already exists");
    process.exit(0);
  }
  const data = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  data.updatedAt = new Date().toISOString();
  save(data);
  console.log("created", instancePath);
  process.exit(0);
}

if (cmd === "show") {
  const data = load();
  if (!data) {
    console.error("No .travel/instance.json — run: node scripts/instance.mjs init");
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

if (cmd === "set" && rest.length >= 2) {
  const key = rest[0];
  const value = rest.slice(1).join(" ");
  let data = load();
  if (!data) {
    fs.mkdirSync(travelDir, { recursive: true });
    data = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  }
  const parts = key.split(".");
  let cur = data;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  try {
    cur[last] = JSON.parse(value);
  } catch {
    cur[last] = value;
  }
  save(data);
  console.log("set", key);
  process.exit(0);
}

if (cmd === "merge" && rest[0]) {
  let data = load();
  if (!data) {
    data = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  }
  const patch = JSON.parse(fs.readFileSync(path.resolve(rest[0]), "utf8"));
  Object.assign(data, patch);
  save(data);
  console.log("merged into instance.json");
  process.exit(0);
}

console.error(`Usage:
  node scripts/instance.mjs init
  node scripts/instance.mjs show
  node scripts/instance.mjs set <dotted.key> <value>
  node scripts/instance.mjs merge <patch.json>`);
process.exit(1);
