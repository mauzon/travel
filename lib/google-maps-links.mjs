/**
 * Canonical Google Maps link strategy (shared by scripts and bundled UI).
 *
 * Priority when building the outbound link:
 * 1) google.cid (from list feature id 0x…:0x… → decimal of second hex)
 * 2) Real Places API place_id (ChIJ… / Eh… / …) → search + query_place_id
 * 3) Preserved source URL (goo.gl, ?cid=, /maps/place/…)
 * 4) Text search query (name, address, city) — never place_id:/g/…
 * 5) Last resort: query=lat,lng
 */

const REAL_PLACE_ID = /^(ChIJ|Eh[A-Za-z0-9_-]{10,}|[A-Za-z0-9_-]{20,})$/;
const MID_PATTERN = /^\/?g\/[A-Za-z0-9_-]+$/i;
const FEATURE_ID = /!1s(0x[a-fA-F0-9]+):(0x[a-fA-F0-9]+)/;
const FEATURE_ID_LOOSE = /(0x[a-fA-F0-9]+):(0x[a-fA-F0-9]+)/;

export const FORBIDDEN_URL_SUBSTRINGS = ["place_id:/g/", "place_id:g/", "query_place_id=/g/", "query_place_id=g/"];

export function hasForbiddenMapsPattern(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return FORBIDDEN_URL_SUBSTRINGS.some((s) => lower.includes(s.toLowerCase())) || /place_id:%2Fg%2f/i.test(url);
}

export function isKnowledgeGraphMid(value) {
  if (!value) return false;
  const s = String(value).trim();
  return MID_PATTERN.test(s) || MID_PATTERN.test(`/${s.replace(/^\//, "")}`);
}

export function isRealPlaceId(value) {
  if (!value || typeof value !== "string") return false;
  const s = value.trim();
  if (!s || isKnowledgeGraphMid(s)) return false;
  if (s.startsWith("place_id:")) return isRealPlaceId(s.slice("place_id:".length));
  return /^ChIJ[\w-]+$/.test(s) || /^Eh[\w-]+$/.test(s) || /^Gh[\w-]+$/.test(s);
}

export function hexFeaturePartToCid(hexPart) {
  if (!hexPart) return null;
  const h = String(hexPart).replace(/^0x/i, "");
  if (!/^[a-fA-F0-9]+$/.test(h)) return null;
  try {
    return BigInt(`0x${h}`).toString(10);
  } catch {
    return null;
  }
}

export function featureIdToCid(featureId) {
  if (!featureId) return null;
  const m = String(featureId).match(FEATURE_ID_LOOSE);
  if (!m) return null;
  return hexFeaturePartToCid(m[2]);
}

export function parseFeatureIdFromText(text) {
  if (!text) return null;
  const m = String(text).match(FEATURE_ID) || String(text).match(FEATURE_ID_LOOSE);
  if (!m) return null;
  return { feature_id: `${m[1]}:${m[2]}`, cid: hexFeaturePartToCid(m[2]) };
}

export function cidFromUrl(url) {
  const m = url?.match(/[?&]cid=(\d+)/);
  return m ? m[1] : null;
}

export function midFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/g\/([A-Za-z0-9_-]+)/);
  return m ? `/g/${m[1]}` : null;
}

export function placeIdFromUrl(url) {
  if (!url) return null;
  const patterns = [
    /[?&]query_place_id=([^&]+)/,
    /[?&]place_id=([^&]+)/,
    /place_id:([^&]+)/,
    /[?&]q=place_id:([^&]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (!m) continue;
    let id = decodeURIComponent(m[1].replace(/\+/g, " "));
    if (id.startsWith("place_id:")) id = id.slice("place_id:".length);
    if (isKnowledgeGraphMid(id)) return null;
    if (isRealPlaceId(id)) return id;
  }
  return null;
}

export function isPreservedSourceMapsUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (!/^https:\/\//i.test(url)) return false;
  if (hasForbiddenMapsPattern(url)) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "maps.app.goo.gl" || host.endsWith(".app.goo.gl")) return true;
    if (/[?&]cid=\d+/.test(url)) return true;
    if (u.pathname.includes("/maps/place")) return true;
    if ((host.includes("google.") || host === "goo.gl") && url.includes("maps")) {
      if (u.pathname.startsWith("/maps") && !url.includes("search/?api=1")) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function buildSearchQueryParts(place, cityName) {
  const parts = [
    place.name_en || place.name,
    place.address || place.district || place.district_en,
    cityName,
  ].filter(Boolean);
  return [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))].join(" ");
}

export function buildSearchMapsUrl(query) {
  const q = encodeURIComponent(query).replace(/%20/g, "+");
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function buildPlaceIdMapsUrl(query, placeId) {
  const q = encodeURIComponent(query).replace(/%20/g, "+");
  const pid = encodeURIComponent(placeId);
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${pid}`;
}

export function buildCidMapsUrl(cid) {
  return `https://maps.google.com/?cid=${cid}`;
}

export function buildCoordsMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * @param {object} google - { cid, place_id, mid, maps_url, feature_id }
 * @param {object} ctx - { name, name_en, address, cityName, lat, lng }
 */
export function buildCanonicalMapsUrl(google, ctx) {
  const g = google || {};
  if (g.cid && /^\d+$/.test(String(g.cid))) {
    return buildCidMapsUrl(String(g.cid));
  }
  if (g.place_id && isRealPlaceId(g.place_id)) {
    const query = buildSearchQueryParts(ctx, ctx.cityName);
    return buildPlaceIdMapsUrl(query, g.place_id);
  }
  if (g.maps_url && isPreservedSourceMapsUrl(g.maps_url)) {
    return g.maps_url;
  }
  const query = buildSearchQueryParts(ctx, ctx.cityName);
  if (query) return buildSearchMapsUrl(query);
  if (ctx.lat != null && ctx.lng != null) return buildCoordsMapsUrl(ctx.lat, ctx.lng);
  return "https://www.google.com/maps";
}

export function parseUrlIntoGoogleFields(url) {
  const out = {};
  if (!url) return out;
  const feat = parseFeatureIdFromText(url);
  if (feat) {
    out.feature_id = feat.feature_id;
    if (feat.cid) out.cid = feat.cid;
  }
  const fromCid = cidFromUrl(url);
  if (fromCid) out.cid = fromCid;
  const pid = placeIdFromUrl(url);
  if (pid) out.place_id = pid;
  const mid = midFromUrl(url);
  if (mid && !out.place_id) out.mid = mid;
  if (isPreservedSourceMapsUrl(url)) out.maps_url = url;
  return out;
}

export function mergeGoogleFields(existing, incoming) {
  const base = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (v != null && v !== "") base[k] = v;
  }
  if (base.place_id && (isKnowledgeGraphMid(base.place_id) || !isRealPlaceId(base.place_id))) {
    if (isKnowledgeGraphMid(base.place_id)) {
      const raw = base.place_id.startsWith("/") ? base.place_id : `/${base.place_id.replace(/^\//, "")}`;
      base.mid = base.mid || raw;
    }
    delete base.place_id;
  }
  return base;
}

export function ingestMapsIdentity(row, cityName) {
  const legacyPid = row.maps_place_id || row.place_id;
  const fromUrl = parseUrlIntoGoogleFields(row.maps_url);
  const google = mergeGoogleFields(row.google, fromUrl);

  if (legacyPid) {
    if (isRealPlaceId(legacyPid)) google.place_id = google.place_id || legacyPid;
    else if (isKnowledgeGraphMid(legacyPid)) {
      google.mid = google.mid || (legacyPid.startsWith("/") ? legacyPid : `/${legacyPid.replace(/^\//, "")}`);
    }
  }

  if (row.cid) google.cid = String(row.cid);

  const maps_url = buildCanonicalMapsUrl(google, {
    name: row.name,
    name_en: row.name_en,
    address: row.address,
    cityName,
    lat: row.lat,
    lng: row.lng,
  });

  return { google, maps_url };
}

export function validateOutboundMapsUrl(url, label) {
  const errors = [];
  if (!url) errors.push(`${label}: missing maps_url`);
  else if (!/^https:\/\//i.test(url)) errors.push(`${label}: must be https`);
  if (hasForbiddenMapsPattern(url)) errors.push(`${label}: forbidden /g/ MID in place_id parameter`);
  return errors;
}

export function validatePlaceMapsLink(place, cityName) {
  const label = place.id || place.name || "place";
  const errors = [];
  errors.push(...validateOutboundMapsUrl(place.maps_url, label));

  const google = place.google || {};
  if (google.place_id && !isRealPlaceId(google.place_id)) {
    errors.push(`${label}: google.place_id is not a valid Places id`);
  }
  if (google.mid && !isKnowledgeGraphMid(google.mid)) {
    errors.push(`${label}: google.mid malformed`);
  }

  const expected = buildCanonicalMapsUrl(google, {
    name: place.name,
    name_en: place.name_en,
    address: place.address,
    cityName,
    lat: place.lat,
    lng: place.lng,
  });
  return errors;
}