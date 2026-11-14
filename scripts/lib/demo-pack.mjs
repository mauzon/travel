/**
 * Demo data pack load/remove: local dir, https URL, or GitHub tree/blob links.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ALLOWED_TARGET = /^data\/cities\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const ALLOWED_FILE = /^[a-zA-Z0-9._-]+\.json$/;

export function packValidator(rootDir) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(rootDir, "data/schema/pack.schema.json"), "utf8"),
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function assertSafeTarget(target) {
  if (!ALLOWED_TARGET.test(target)) {
    throw new Error(`Disallowed target path: ${target}`);
  }
  const resolved = path.normalize(target);
  if (resolved.includes("..") || path.isAbsolute(resolved)) {
    throw new Error(`Path traversal rejected: ${target}`);
  }
}

export function assertSafePackFile(rel) {
  if (!ALLOWED_FILE.test(rel) || rel.includes("/") || rel.includes("..")) {
    throw new Error(`Disallowed pack file path: ${rel}`);
  }
}

/**
 * @param {string} input URL or shorthand
 * @returns {{ manifestUrl: string, fileBaseUrl: string }}
 */
export function resolvePackUrls(input) {
  const trimmed = input.trim().replace(/\/$/, "");
  if (!/^https:\/\//i.test(trimmed)) {
    throw new Error("Remote packs must use https:// URLs");
  }

  if (trimmed.endsWith("/pack.json")) {
    const base = trimmed.slice(0, -"/pack.json".length);
    return { manifestUrl: trimmed, fileBaseUrl: base };
  }

  const tree = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
  if (tree) {
    const [, owner, repo, ref, packPath] = tree;
    const base = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${packPath}`;
    return { manifestUrl: `${base}/pack.json`, fileBaseUrl: base };
  }

  const blob = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (blob) {
    const [, owner, repo, ref, filePath] = blob;
    if (!filePath.endsWith("pack.json")) {
      throw new Error("GitHub blob URL must point at pack.json or use a tree link to the pack folder");
    }
    const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
    const fileBaseUrl = manifestUrl.slice(0, -"/pack.json".length);
    return { manifestUrl, fileBaseUrl };
  }

  if (/^https:\/\/raw\.githubusercontent\.com\//.test(trimmed)) {
    return {
      manifestUrl: `${trimmed}/pack.json`,
      fileBaseUrl: trimmed,
    };
  }

  throw new Error("Unrecognized pack URL; use a pack folder (tree link), pack.json blob/raw URL, or raw base URL");
}

export async function fetchText(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function validateManifest(manifest, validate) {
  if (!validate(manifest)) {
    throw new Error(`Invalid pack.json: ${JSON.stringify(validate.errors)}`);
  }
  for (const f of manifest.files) {
    assertSafePackFile(f.path);
    assertSafeTarget(f.target);
  }
}

export function applyPack(manifest, filesByPath, rootDir) {
  fs.mkdirSync(path.join(rootDir, "data/cities"), { recursive: true });
  for (const entry of manifest.files) {
    const body = filesByPath[entry.path];
    if (body == null) throw new Error(`Missing pack file content: ${entry.path}`);
    const dest = path.join(rootDir, entry.target);
    assertSafeTarget(entry.target);
    fs.writeFileSync(dest, body.endsWith("\n") ? body : `${body}\n`);
  }
  fs.writeFileSync(
    path.join(rootDir, "config.json"),
    JSON.stringify(manifest.config, null, 2) + "\n",
  );
}

export function loadPackFromDir(packDir, rootDir, validate) {
  const manifestPath = path.join(packDir, "pack.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validateManifest(manifest, validate);
  const filesByPath = {};
  for (const entry of manifest.files) {
    const src = path.join(packDir, entry.path);
    assertSafePackFile(entry.path);
    if (!fs.existsSync(src)) throw new Error(`Pack file missing: ${src}`);
    filesByPath[entry.path] = fs.readFileSync(src, "utf8");
  }
  applyPack(manifest, filesByPath, rootDir);
  return manifest;
}

export async function loadPackFromUrl(input, rootDir, validate) {
  const { manifestUrl, fileBaseUrl } = resolvePackUrls(input);
  const manifest = JSON.parse(await fetchText(manifestUrl));
  validateManifest(manifest, validate);
  const filesByPath = {};
  for (const entry of manifest.files) {
    const url = `${fileBaseUrl}/${entry.path}`;
    filesByPath[entry.path] = await fetchText(url);
  }
  applyPack(manifest, filesByPath, rootDir);
  return manifest;
}

export function removePackByManifest(manifest, rootDir) {
  const configPath = path.join(rootDir, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  for (const entry of manifest.files) {
    assertSafeTarget(entry.target);
    const dest = path.join(rootDir, entry.target);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
  }
  const drop = new Set(manifest.cityIds);
  config.cities = (config.cities || []).filter((c) => !drop.has(c.slug));
  if (drop.has(config.defaultCity)) {
    config.defaultCity = config.cities[0]?.slug || "";
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function clearAll(rootDir) {
  const citiesDir = path.join(rootDir, "data/cities");
  fs.mkdirSync(citiesDir, { recursive: true });
  for (const f of fs.readdirSync(citiesDir)) {
    if (f.endsWith(".json")) fs.unlinkSync(path.join(citiesDir, f));
  }
  const empty = {
    defaultLang: "en",
    defaultCity: "",
    siteTitle: "Места для поездки",
    siteTitle_en: "Travel places",
    googleList: "",
    cities: [],
  };
  fs.writeFileSync(path.join(rootDir, "config.json"), JSON.stringify(empty, null, 2) + "\n");
}

export function readManifestOnly(packId, rootDir, validate) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, "demo", packId, "pack.json"), "utf8"),
  );
  validateManifest(manifest, validate);
  return manifest;
}
