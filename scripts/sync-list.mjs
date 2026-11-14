#!/usr/bin/env node
/**
 * Re-sync Google Maps list places into city JSON (dry run by default).
 * Usage: node scripts/sync-list.mjs [--city slug|--all] [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  ingestMapsIdentity,
  isRealPlaceId,
  mergeGoogleFields,
  parseUrlIntoGoogleFields,
} from "../lib/google-maps-links.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
const apply = process.argv.includes("--apply");
let cityArg = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--city") cityArg = process.argv[++i];
}

const cities = cityArg
  ? config.cities.filter((c) => c.slug === cityArg)
  : config.cities;
if (!cities.length) {
  console.error("No matching city");
  process.exit(1);
}

function normName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function namesCompatible(a, b) {
  const namesA = [a.name, a.name_en].filter(Boolean).map(normName);
  const namesB = [b.name, b.name_en].filter(Boolean).map(normName);
  for (const na of namesA) {
    for (const nb of namesB) {
      if (!na || !nb) continue;
      if (na === nb) return true;
      if (na.includes(nb) || nb.includes(na)) return true;
    }
  }
  return false;
}

const MATCH_DIST_M = 150;
const PIN_DIST_M = 35;

function placeKeys(row) {
  const g = row.google || {};
  return {
    pid: g.place_id || (isRealPlaceId(row.maps_place_id) ? row.maps_place_id : null),
    cid: g.cid ? String(g.cid) : row.cid ? String(row.cid) : null,
    lat: row.lat,
    lng: row.lng,
    name: row.name,
    name_en: row.name_en,
  };
}

function samePlace(local, remote) {
  const a = placeKeys(local);
  const b = placeKeys(remote);
  if (a.pid && b.pid && a.pid === b.pid) return true;
  if (a.cid && b.cid && a.cid === b.cid) return true;
  const d = distM(a, b);
  if (d <= PIN_DIST_M) return true;
  if (d <= MATCH_DIST_M && namesCompatible(local, remote)) return true;
  return false;
}

function pairListLocals(remotes, locals) {
  const used = new Set();
  const pairs = [];
  for (const remote of remotes) {
    const local = locals.find((p, i) => !used.has(i) && samePlace(p, remote));
    if (local) {
      const idx = locals.indexOf(local);
      used.add(idx);
      pairs.push({ local, remote });
    } else {
      pairs.push({ local: null, remote });
    }
  }
  const unmatchedLocals = locals.filter((_, i) => !used.has(i));
  return { pairs, unmatchedLocals };
}

function distM(a, b) {
  if (a.lat == null || b.lat == null) return Infinity;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function haversineKm(center, p) {
  const R = 6371;
  const dLat = ((p.lat - center.lat) * Math.PI) / 180;
  const dLng = ((p.lng - center.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((center.lat * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function extractList(url) {
  const cachePath = path.join(root, "data/cache/list-extract.json");
  const maxAge = 1000 * 60 * 60;
  if (fs.existsSync(cachePath) && Date.now() - fs.statSync(cachePath).mtimeMs < maxAge) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const proc = spawn("node", [path.join(root, "scripts/extract-list.mjs"), url], {
    cwd: root,
    env: { ...process.env, OUTPUT: cachePath },
  });
  await new Promise((resolve, reject) => {
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("extract failed"))));
  });
  return JSON.parse(fs.readFileSync(cachePath, "utf8"));
}

const report = { generated_at: new Date().toISOString(), apply, cities: {} };

async function loadListItems() {
  const listUrl = config.googleList;
  try {
    const extracted = await extractList(listUrl);
    if (extracted.items?.length) return extracted.items;
  } catch (e) {
    console.warn("live extract failed, using data/raw/list.json:", e.message);
  }
  const localPath = path.join(root, "data/raw/list.json");
  if (!fs.existsSync(localPath)) return [];
  const local = JSON.parse(fs.readFileSync(localPath, "utf8"));
  return (local.places || []).map((p) => ({
    name: p.name,
    note: p.note,
    lat: p.lat,
    lng: p.lng,
    maps_url: p.maps_url,
    google: p.google,
    place_id: p.place_id,
    cid: p.cid,
  }));
}

const items = await loadListItems();

for (const cityCfg of cities) {
  const file = path.join(root, "data/cities", `${cityCfg.slug}.json`);
  const city = JSON.parse(fs.readFileSync(file, "utf8"));
  const cityName = city.name_en || city.name_ru || cityCfg.slug;
  const filter = city.source?.filter;
  if (!filter) {
    console.error(`Missing source.filter for ${cityCfg.slug}`);
    process.exit(1);
  }
  const center = { lat: filter.lat, lng: filter.lng };
  const filtered = items.filter(
    (it) => it.lat != null && haversineKm(center, it) <= filter.radius_km,
  );

  const listPlaces = city.places.filter((p) => p.source === "list");

  const slugId = (name, google) => {
    if (google?.cid) return `cid-${google.cid}`;
    if (google?.place_id && isRealPlaceId(google.place_id)) {
      return google.place_id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
    }
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  };

  const remotes = [];
  for (const it of filtered) {
    const google = mergeGoogleFields(it.google, parseUrlIntoGoogleFields(it.maps_url));
    if (it.cid) google.cid = String(it.cid);
    if (it.place_id && isRealPlaceId(it.place_id)) google.place_id = it.place_id;
    const ingested = ingestMapsIdentity(
      {
        name: it.name,
        name_en: it.name,
        address: it.address,
        lat: it.lat,
        lng: it.lng,
        maps_url: it.maps_url,
        google,
        user_note: it.note,
      },
      cityName,
    );
    remotes.push({
      name: it.name,
      maps_url: ingested.maps_url,
      google: ingested.google,
      maps_place_id: ingested.google?.place_id,
      lat: it.lat,
      lng: it.lng,
      user_note: it.note,
    });
  }

  const { pairs, unmatchedLocals } = pairListLocals(remotes, listPlaces);
  const added = pairs.filter((p) => !p.local).map((p) => p.remote);
  const removed = unmatchedLocals.map((p) => ({ id: p.id, name: p.name }));
  const changed = [];

  for (const { local, remote } of pairs) {
    if (!local) continue;
    const changes = [];
    if (remote.user_note != null && remote.user_note !== local.user_note) changes.push("note");
    const rn = normName(remote.name);
    const ln = normName(local.name);
    const le = normName(local.name_en);
    if (rn && rn !== ln && rn !== le) changes.push("name");
    if (remote.lat != null && local.lat != null && distM(local, remote) > 1) changes.push("coords");
    if (remote.maps_url && remote.maps_url !== local.maps_url) changes.push("maps_url");
    if (changes.length) changed.push({ id: local.id, name: local.name, changes, remote });
  }

  report.cities[cityCfg.slug] = {
    filter,
    remote_in_radius: filtered.length,
    local_list: listPlaces.length,
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    added_items: added.map((a) => a.name),
    removed_items: removed.map((r) => r.name),
    changed_items: changed,
  };

  if (apply) {
    city.places = city.places.filter((p) => p.source !== "list" || !removed.some((r) => r.id === p.id));
    for (const ch of changed) {
      const p = city.places.find((x) => x.id === ch.id);
      if (!p) continue;
      if (ch.changes.includes("note")) p.user_note = ch.remote.user_note;
      if (ch.changes.includes("name")) p.name = ch.remote.name;
      if (ch.changes.includes("coords")) {
        p.lat = ch.remote.lat;
        p.lng = ch.remote.lng;
      }
      if (ch.changes.includes("maps_url")) {
        p.maps_url = ch.remote.maps_url;
        p.google = ch.remote.google;
        p.maps_place_id = ch.remote.maps_place_id;
      }
    }
    for (const a of added) {
      city.places.push({
        id: slugId(a.name, a.google),
        name: a.name,
        name_en: a.name,
        category: "uncategorized",
        source: "list",
        maps_url: a.maps_url,
        google: a.google,
        maps_place_id: a.maps_place_id,
        lat: a.lat,
        lng: a.lng,
        user_note: a.user_note,
        needs_enrichment: true,
        sort_km: 9999,
        walk: { label: "" },
        taxi: { label: "" },
        transit: { description: "" },
      });
    }
    fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
    if (added.length) {
      console.log(`Running enrich-routes for ${cityCfg.slug}...`);
      await new Promise((resolve, reject) => {
        const proc = spawn("node", [path.join(root, "scripts/enrich-routes.mjs"), file], {
          cwd: root,
          stdio: "inherit",
        });
        proc.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("enrich failed"))));
      });
    }
  }
}

const reportPath = path.join(root, "data/sync-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
console.log(`wrote ${reportPath}${apply ? " (applied)" : " (dry run)"}`);