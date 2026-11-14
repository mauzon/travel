#!/usr/bin/env node
/**
 * Extract Google Maps saved list via public preview API.
 * Usage: node scripts/extract-list.mjs <maps-list-url-or-id>
 */
import fs from "node:fs";
import {
  featureIdToCid,
  isPreservedSourceMapsUrl,
  isRealPlaceId,
  mergeGoogleFields,
  parseFeatureIdFromText,
  parseUrlIntoGoogleFields,
  placeIdFromUrl,
} from "../lib/google-maps-links.mjs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/extract-list.mjs <google-maps-list-url>");
  process.exit(1);
}

async function resolveUrl(url) {
  if (!url.includes("goo.gl") && !url.includes("google.com")) return url;
  const res = await fetch(url, { redirect: "follow" });
  return res.url;
}

function listIdFrom(url) {
  const m = url.match(/!1s([^!]+)/) || url.match(/list\/([^/?]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (/^[A-Za-z0-9_-]{10,}$/.test(url)) return url;
  throw new Error("Could not parse list id from URL");
}

async function fetchList(listId) {
  const pb = `!1m4!1s${listId}!2e1!3m1!1e1!2e2!3e2!4i500`;
  const api = `https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&pb=${encodeURIComponent(pb)}`;
  const res = await fetch(api, {
    headers: { "User-Agent": "travel-places/1.0" },
  });
  if (!res.ok) throw new Error(`getlist HTTP ${res.status}`);
  let text = await res.text();
  if (text.startsWith(")]}'")) text = text.slice(4);
  return JSON.parse(text);
}

function normalizeItem(entry) {
  const name = entry?.[1]?.[0]?.[0]?.[0] ?? entry?.[0];
  const note = entry?.[1]?.[0]?.[2]?.[0]?.[0];
  const lat = entry?.[1]?.[0]?.[5]?.[0]?.[2];
  const lng = entry?.[1]?.[0]?.[5]?.[0]?.[3];
  const address = entry?.[1]?.[0]?.[3]?.[0]?.[0];
  const placeUrl = entry?.[1]?.[0]?.[6]?.[0];
  const icon = entry?.[1]?.[0]?.[7]?.[0];
  const blob = JSON.stringify(entry);
  const fromBlob = parseFeatureIdFromText(blob);
  const fromUrl = parseUrlIntoGoogleFields(placeUrl);
  const google = mergeGoogleFields(fromUrl, fromBlob);
  const rawPid = placeIdFromUrl(placeUrl);
  if (rawPid) google.place_id = rawPid;
  const legacyFeat = placeUrl?.match(/!1s(0x[a-fA-F0-9]+):(0x[a-fA-F0-9]+)/);
  if (legacyFeat && !google.feature_id) {
    google.feature_id = `${legacyFeat[1]}:${legacyFeat[2]}`;
    google.cid = google.cid || featureIdToCid(google.feature_id);
  }
  if (placeUrl && isPreservedSourceMapsUrl(placeUrl)) google.maps_url = placeUrl;

  let place_id = google.place_id || null;
  if (place_id && !isRealPlaceId(place_id)) place_id = null;
  const mid = google.mid || midFromItem(placeUrl);
  if (mid) google.mid = mid;

  return {
    name: name || "Unknown",
    note: note || null,
    address: address || null,
    lat: lat ?? null,
    lng: lng ?? null,
    maps_url: placeUrl || null,
    google: Object.keys(google).length ? google : undefined,
    place_id,
    cid: google.cid || null,
    icon: icon || null,
  };
}

function midFromItem(url) {
  if (!url) return null;
  const m = url.match(/\/g\/([A-Za-z0-9_-]+)/);
  return m ? `/g/${m[1]}` : null;
}

function flatten(data) {
  const items = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node[1]?.[0]?.[5]?.[0]?.[2] != null) {
        try {
          items.push(normalizeItem(node));
        } catch {
          /* skip malformed */
        }
      }
      for (const child of node) walk(child);
    }
  };
  walk(data);
  const seen = new Set();
  return items.filter((it) => {
    const k = `${it.name}|${it.lat}|${it.lng}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const resolved = await resolveUrl(input);
const listId = listIdFrom(resolved);
const raw = await fetchList(listId);
const items = flatten(raw);
const out = { list_id: listId, resolved_url: resolved, extracted_at: new Date().toISOString(), items };
const outPath = process.env.OUTPUT || "-";
const payload = JSON.stringify(out, null, 2) + "\n";
if (outPath === "-") process.stdout.write(payload);
else fs.writeFileSync(outPath, payload);
if (outPath !== "-") console.error(`wrote ${outPath}`);
console.error(`extracted ${items.length} items`);
