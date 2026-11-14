/**
 * Split Google list user_note from assistant description on city places/events.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pd = JSON.parse(fs.readFileSync(path.join(root, "asia/page_data.json"), "utf8"));
const list = JSON.parse(fs.readFileSync(path.join(root, "data/raw/list.json"), "utf8"));
const listByPid = new Map();
for (const p of list.places) {
  if (p.place_id) listByPid.set(p.place_id, p);
}

const cityKeys = { bangkok: "bangkok", "chiang-mai": "chiang_mai" };

function findPd(citySlug, place) {
  const key = cityKeys[citySlug];
  const arr = pd[key] || [];
  const id = place.maps_place_id;
  return arr.find((p) => p.place_id === id || p.maps_url === place.maps_url);
}

for (const slug of Object.keys(cityKeys)) {
  const file = path.join(root, "data/cities", `${slug}.json`);
  const city = JSON.parse(fs.readFileSync(file, "utf8"));

  for (const row of [...city.places, ...city.events]) {
    const pdRow = findPd(slug, row);
    const pid = row.maps_place_id;
    const fromList = pid ? listByPid.get(pid) : null;
    const googleNote = fromList?.note ?? (pdRow?.source === "user" ? pdRow.note : null);

    if (row.source === "list") {
      row.user_note = googleNote || row.user_note || undefined;
      if (!row.user_note) delete row.user_note;
      delete row.note_en;
      delete row.description;
      delete row.description_en;
    } else if (row.source === "added" || row.source === "event") {
      const text = row.description ?? row.user_note;
      if (text) {
        row.description = text;
        row.description_en = row.description_en ?? row.note_en;
        if (row.description_en === text) delete row.description_en;
      }
      delete row.user_note;
      delete row.note_en;
      if (row.source === "event" && pdRow?.note && !row.description) {
        row.description = pdRow.note;
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(city, null, 2) + "\n");
  console.log("split notes:", slug);
}
