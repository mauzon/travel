# Demo data packs

Each folder under `demo/<pack-id>/` is a **self-describing data pack** an agent can apply without running project scripts.

## Layout

```
demo/<pack-id>/
  pack.json       # manifest (schema: data/schema/pack.schema.json)
  <city>.json     # city bundle(s), paths listed in pack.json
```

### `pack.json` fields

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Currently `1` |
| `id` | Pack identifier (e.g. `london`) |
| `name` / `description` | Human-readable summary |
| `cityIds` | City slugs this pack installs |
| `config` | Full `config.json` to write when the pack is applied |
| `files` | `{ "path": "<file in this folder>", "target": "data/cities/<slug>.json" }` |

Targets are limited to `data/cities/*.json` (no `..`, no other directories).

## Public URLs for agents

Replace `OWNER`, `REPO`, `REF`, and `PACK` with your fork and branch:

| Link you have | Fetch manifest |
|---------------|----------------|
| `https://github.com/OWNER/REPO/tree/REF/demo/PACK` | `https://raw.githubusercontent.com/OWNER/REPO/REF/demo/PACK/pack.json` |
| `https://github.com/OWNER/REPO/blob/REF/demo/PACK/pack.json` | Same raw path as blob path |
| `https://raw.githubusercontent.com/OWNER/REPO/REF/demo/PACK/pack.json` | Use directly |

For each `files[].path`, fetch:

`https://raw.githubusercontent.com/OWNER/REPO/REF/demo/PACK/<path>`

## Apply with CLI (shell available)

```bash
npm run demo -- london
npm run demo -- https://github.com/mauzon/pinkeepr/tree/main/demo/london
npm run demo -- remove london
npm run demo -- clear
```

## Apply without CLI (GitHub API only)

1. `GET` `pack.json` from the raw URL above.
2. Validate JSON against `data/schema/pack.schema.json` (fetch that schema from the same repo ref).
3. For each entry in `files`, `GET` the pack file and `PUT` repository contents API at `target` (base64 body).
4. `PUT` `config.json` with the manifest `config` object (pretty-printed JSON + trailing newline).
5. Commit message example: `Load data pack london (demo)`.
6. Push triggers Cloudflare / Vercel / Railway redeploy when the repo is connected.

For the full lifecycle (fork, deploy, access, resume later), agents should follow **[AGENTS.md](../AGENTS.md)** and maintain `.travel/instance.json`.

## Remove a pack

1. Read the same `pack.json`.
2. Delete each `files[].target` via the GitHub API (or delete blobs in a single commit).
3. Edit `config.json`: remove `cityIds` from `cities`, clear or change `defaultCity` if it was one of those slugs.

Or run `npm run demo -- remove <pack-id>` locally using `demo/<pack-id>/pack.json` as the removal manifest.

## Shipped packs

| Pack | Description |
|------|-------------|
| [`london`](london/) | 18 London sights, Westminster hotel + O2 concert origins |
| [`example`](example/) | Small Lisbon sample (neutral Hotel/Venue labels) |
