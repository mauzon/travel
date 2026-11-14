# Google Maps outbound links (canonical rules)

All **Open in Google Maps** links (UI, share sheet, exports) must come from **`lib/google-maps-links.mjs`** — never hand-build `place_id:` URLs.

## Stored fields (`google` object)

| Field | Meaning |
| --- | --- |
| `google.cid` | Decimal CID derived from the list feature id (`0x…:0x…`, second hex → decimal) |
| `google.place_id` | Real Places API id (`ChIJ…`, `Eh…`, …) — **not** a Knowledge Graph `/g/…` MID |
| `google.mid` | Knowledge Graph MID (`/g/11wpjzh929`) when known — **never** used as `place_id` |
| `google.maps_url` | Original user/list URL when it is already a valid Maps link |
| `google.feature_id` | Raw `0x…:0x…` pair from list `data=!1s…` when captured |

`maps_url` on each place/event/hotel is the **canonical outbound URL** produced by the helper from `google` + name/address/city.

## Link priority (helper output)

1. **`https://maps.google.com/?cid=<CID>`** when `google.cid` is set.
2. **`https://www.google.com/maps/search/?api=1&query=…&query_place_id=<place_id>`** when `google.place_id` is a real Places id.
3. **Verbatim `google.maps_url`** when the source link is a valid Maps URL (`maps.app.goo.gl`, `?cid=`, `/maps/place/…`).
4. **Text search** `…/search/?api=1&query=<encoded name, address, city>`.
5. **Last resort:** `query=<lat>,<lng>` only when nothing else exists.

## Forbidden

- `place_id:/g/…` or `query_place_id=/g/…` (opens “No results” in Maps).
- Putting a `/g/…` MID into `maps_place_id` or `google.place_id`.

## Scripts

| Script | Role |
| --- | --- |
| `lib/google-maps-links.mjs` | Single source of truth: parse, merge, `buildCanonicalMapsUrl`, `ingestMapsIdentity` |
| `scripts/extract-list.mjs` | List import: feature id → CID, preserve source URL, split MID vs `place_id` |
| `scripts/sync-list.mjs` / `scripts/merge-city.mjs` | Apply ingest on list merge |
| `scripts/fix-maps-links.mjs --write` | Recompute all city + demo JSON |
| `scripts/check-maps-links.mjs` | CI guard (optional `--resolve` to follow `?cid=` redirects) |
| `npm run validate` | Fails on forbidden URL patterns and invalid `google.*` |

## UI

`src/maps-link.ts` wraps the same helper for React (`resolvePlaceMapsUrl`, `resolveHotelMapsUrl`, `resolveOriginMapsUrl`).