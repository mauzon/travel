/** Validate external URLs in city bundles (https only). */

const HTTPS = /^https:\/\//i;

export function assertHttpsUrl(url, label) {
  if (url == null || url === "") return;
  if (!HTTPS.test(url)) {
    throw new Error(`${label}: URL must use https:// — got ${url}`);
  }
}

export function collectHttpViolations(city, fileLabel) {
  const bad = [];
  const check = (url, label) => {
    if (url && !HTTPS.test(url)) bad.push({ file: fileLabel, field: label, url });
  };
  check(city.hotel?.maps_url, "hotel.maps_url");
  for (const o of city.origins || []) check(o.google_maps_url, `origins.${o.id}.google_maps_url`);
  for (const u of city.sources || []) check(u, "sources[]");
  for (const p of [...(city.places || []), ...(city.events || [])]) {
    check(p.maps_url, `${p.id}.maps_url`);
    for (const u of p.source_urls || []) check(u, `${p.id}.source_urls[]`);
  }
  return bad;
}
