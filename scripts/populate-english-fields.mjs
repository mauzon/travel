/**
 * Populate name_en, note_en, *_en fields from page_data, events, and data/i18n/ru-en.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ruEnPath = path.join(root, "data/i18n/ru-en.json");
const ruEn = fs.existsSync(ruEnPath) ? JSON.parse(fs.readFileSync(ruEnPath, "utf8")) : {};
const pd = JSON.parse(fs.readFileSync(path.join(root, "asia/page_data.json"), "utf8"));
const ev = JSON.parse(fs.readFileSync(path.join(root, "asia/event_rows.json"), "utf8"));

const cityKeys = { bangkok: "bangkok", "chiang-mai": "chiang_mai" };
const eventKeys = { bangkok: "bkk", "chiang-mai": "cnx" };

function tr(text) {
  if (!text) return undefined;
  return ruEn[text] ?? undefined;
}

function pid(url) {
  const m = url?.match(/place_id:([^&]+)/);
  return m ? m[1] : null;
}

function findPd(citySlug, place) {
  const key = cityKeys[citySlug];
  const list = pd[key] || [];
  const id = place.maps_place_id || pid(place.maps_url);
  return list.find(
    (p) =>
      (id && p.place_id === id) ||
      p.maps_url === place.maps_url ||
      p.name_ru === place.name ||
      p.name === place.name,
  );
}

function applyPlace(citySlug, place) {
  const row = findPd(citySlug, place);
  if (row) {
    place.name_ru = row.name_ru || place.name_ru || place.name;
    place.name_en = row.name || place.name_en || place.name;
    if (row.note && row.source === "user") {
      place.user_note = row.note;
    } else if (row.note && row.source === "added") {
      place.description = row.note;
      place.description_en = tr(row.note) || place.description_en;
    }
    if (row.warning) place.warning_en = tr(row.warning) || place.warning_en;
    if (row.area) {
      place.district_ru = row.area;
      place.district_en = tr(row.area) || place.district_en || row.area;
    }
  } else {
    place.name_ru = place.name_ru || place.name;
    place.name_en = place.name_en || (/[А-Яа-яЁё]/.test(place.name) ? undefined : place.name);
  }
  if (place.description && !place.description_en) place.description_en = tr(place.description);
  if (place.warning && !place.warning_en) place.warning_en = tr(place.warning);
  if (place.schedule_text && !place.schedule_en) place.schedule_en = tr(place.schedule_text);
  if (place.transit?.description && !place.transit.description_en) {
    place.transit.description_en = tr(place.transit.description);
  }
}

function findEvent(citySlug, event) {
  const key = eventKeys[citySlug];
  const list = ev[key] || [];
  return list.find((e) => e.n === event.name || e.maps === event.maps_url);
}

for (const slug of Object.keys(cityKeys)) {
  const file = path.join(root, "data/cities", `${slug}.json`);
  const city = JSON.parse(fs.readFileSync(file, "utf8"));

  city.name_ru = city.name_ru || city.name || slug;
  city.name_en = city.name_en || (slug === "bangkok" ? "Bangkok" : "Chiang Mai");

  if (city.hotel) {
    city.hotel.name_en = city.hotel.name_en || city.hotel.name;
    if (city.hotel.transit_description) {
      city.hotel.transit_description_en = tr(city.hotel.transit_description);
    }
    if (city.hotel.district) {
      city.hotel.district_en = tr(city.hotel.district) || city.hotel.district;
    }
  }
  if (city.transport?.transit_description) {
    city.transport.transit_description_en = tr(city.transport.transit_description);
  }

  if (city.ui) {
    if (city.ui.summary) city.ui.summary_en = tr(city.ui.summary) || city.ui.summary_en;
    if (city.ui.callouts) {
      for (const k of Object.keys(city.ui.callouts)) {
        const c = city.ui.callouts[k];
        c.lead_en = tr(c.lead) || c.lead_en;
        c.body_en = tr(c.body) || c.body_en;
      }
    }
  }

  for (const p of city.places) applyPlace(slug, p);
  for (const e of city.events) {
    applyPlace(slug, e);
    const er = findEvent(slug, e);
    if (er?.note) {
      e.description = er.note;
      e.description_en = tr(er.note) || e.description_en;
    }
    if (er?.warn) e.warning_en = tr(er.warn) || e.warning_en;
    if (er?.when) e.schedule_en = tr(er.when) || e.schedule_en;
  }

  fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
  console.log("updated", slug);
}
