# Travel places — agent runbook

**This file is the single authoritative guide** for AI agents (Grok, Claude Code, Codex, Cursor Cloud, Hermes, etc.) managing a user’s travel-places site end to end.

**Template repo:** `https://github.com/mauzon/travel`  
**Rule:** Real trip data stays in the user’s **private** fork unless they explicitly want a public demo.

**Secrets:** Never commit tokens, passwords, or API keys. Store them only in the host’s secret store or local env. Record *non-secret* deployment facts in `.travel/instance.json` (see Phase 6).

---

## How to run the full lifecycle from one user message

Typical user message:

```text
Set up my own travel site from https://github.com/mauzon/travel, load the London demo, deploy to Vercel, and keep the repo private.
```

**Your job:** walk Phases 1→6 in order, skip steps the user already has, ask humans only where marked **ASK HUMAN**, update `.travel/instance.json` after major steps, commit with clear messages, push so Git-connected hosts redeploy.

**Resume later:** read `.travel/instance.json` first, then continue from the right phase.

---

## Phase 1 — Fork or clone the repository

### Decision

| Question | If yes | If no |
|----------|--------|-------|
| User wants **private** trip data? | Fork as **private** (GitHub/GitLab) | Public fork OK only for demos |
| User already has a repo? | Clone that repo; skip fork | Fork template first |
| Agent has **only browser/API**? | Fork via host UI or `POST /repos/{owner}/{repo}/forks` | — |
| Agent has **shell + gh**? | `gh repo fork mauzon/travel --clone` | — |

### GitHub (primary)

**Dashboard:** Fork → set visibility → clone URL `https://github.com/USER/REPO.git`

**API (agent without shell):** `POST https://api.github.com/repos/mauzon/travel/forks` (user OAuth or PAT with `repo` scope — **ASK HUMAN** to authorize; do not ask them to paste the token into chat if the platform offers a secure connector).

**CLI:**

```bash
gh auth login   # ASK HUMAN once if not authenticated
gh repo fork mauzon/travel --clone --fork-name travel
cd travel
node scripts/instance.mjs init
```

### GitLab (alternative)

Import or mirror from GitHub: **New project → Import repository → URL** `https://github.com/mauzon/travel.git`. Use GitLab CI variables for secrets; build command same as below.

### After fork

1. `node scripts/instance.mjs init` (creates `.travel/instance.json` from example; **gitignored** — safe on user machine).
2. Set `repository.url`, `repository.visibility`, `defaultBranch` via `node scripts/instance.mjs set repository.url "…"`.
3. Default branch should stay **`main`** unless the user requests otherwise.

**Do not** copy `mauzon/amtravel` or any private upstream; only `mauzon/travel`.

---

## Phase 2 — Choose a host and deploy

### Decision: pick one provider

| Provider | Best when | Output | Start / serve |
|----------|-----------|--------|----------------|
| **Cloudflare Workers** | User already on Cloudflare, wants Access | `dist/` via `wrangler.jsonc` | Workers static assets |
| **Vercel** | Simple Git deploy, preview URLs | `dist/` (`vercel.json`) | Platform CDN |
| **Railway** | Node `serve` on `$PORT` | `dist/` | `npm start` after build |
| **Netlify** | Static + optional password | `dist/` (`netlify.toml`) | Platform CDN |

**Build (all):** `npm ci && npm run build`  
**Node:** 22 (`.node-version` in repo)

### What to record in instance state

```bash
node scripts/instance.mjs set hosting.provider railway
node scripts/instance.mjs set hosting.projectName my-travel
node scripts/instance.mjs set hosting.productionUrl https://….
```

### Path A — Git integration (preferred for agents with browser only)

1. User opens host dashboard → **Import Git repository** → select their fork.
2. Set build: `npm ci && npm run build` (Railway: use repo `railway.json`; Vercel: `vercel.json`; Netlify: `netlify.toml`).
3. Output directory: **`dist`** (not applicable on Railway — uses `npm start`).
4. Production branch: `main`.
5. Push any commit → host rebuilds automatically.

**ASK HUMAN:** dashboard login or “approve GitHub/GitLab app” once per host.

### Path B — CLI deploy (agent has shell + credentials)

**Cloudflare**

```bash
npm ci && npm run build
npx wrangler deploy
```

**ASK HUMAN:** Cloudflare API token with Workers edit — set as `CLOUDFLARE_API_TOKEN` in env or Wrangler login (never commit).

**Vercel**

```bash
npm i -g vercel   # or npx vercel
vercel link
vercel --prod
```

**ASK HUMAN:** `vercel login` or `VERCEL_TOKEN` in env.

**Railway**

```bash
# Dashboard: New Project → GitHub repo, or:
railway link
railway up
```

**ASK HUMAN:** `railway login` or project token in Railway **Variables** (not in git).

**Netlify**

```bash
netlify link
netlify deploy --prod --build
```

**ASK HUMAN:** Netlify auth token via env.

### Verify deploy

- Open `hosting.productionUrl` (or host default URL).
- Empty fork shows **“No cities yet”** until a pack or city is loaded.
- Update `hosting.gitIntegration: true` in instance file.

---

## Phase 3 — Custom domain (optional)

**ASK HUMAN:** “What domain should we use?” Skip if they want the default `*.vercel.app` / `*.workers.dev` / Railway URL.

| Host | Typical steps |
|------|----------------|
| Cloudflare | DNS zone on CF → Workers/Pages → Custom domain → follow wizard |
| Vercel | Project → Domains → add domain → DNS records user adds at registrar |
| Railway | Service → Settings → Domain → CNAME target |
| Netlify | Domain management → add custom domain |

Record:

```bash
node scripts/instance.mjs set domain.customDomain travel.example.com
node scripts/instance.mjs set domain.dnsManagedBy cloudflare
```

No certificates in repo; platforms issue TLS automatically when DNS is correct.

---

## Phase 4 — Access control (optional)

**ASK HUMAN:** “Should the site be public, or limited to specific people?”

### Cloudflare Access (recommended on Cloudflare)

1. Zero Trust dashboard → **Access → Applications** → Add application → **Self-hosted**.
2. Application domain = production URL or custom domain.
3. Policy: **Allow** → **One-time PIN** (email) or identity provider.
4. Add allowed emails in the policy **Include** rule (email lists).

**Add/remove email later:** edit the same Access policy → update Include list → save.

Record in instance (emails optional; user may prefer blank):

```bash
node scripts/instance.mjs set accessControl.provider cloudflare-access
node scripts/instance.mjs set accessControl.policySummary "One-time PIN for included emails"
# allowedEmails: use merge or manual edit of .travel/instance.json array
```

**Do not** store Cloudflare account IDs or Access app UUIDs in public repos unless the user insists; instance `notes` field is fine on private repos.

### Vercel

- **Deployment Protection** / password (plan-dependent): Project → Settings → Deployment Protection.
- **ASK HUMAN** to set password in dashboard; never commit it.

`accessControl.provider`: `vercel-protection`

### Railway / Netlify (no native email gate)

- Put **Cloudflare** in front (orange-cloud proxy) + Access, or
- Terminate **basic auth** at a reverse proxy (nginx, Caddy) — credentials only in host env:
  - Railway: service variables `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` + custom image (advanced), or
- Netlify: **Password protection** (feature/plan-dependent) in site settings.

`accessControl.provider`: `basic-auth` or `none`

### Public demo

`accessControl.provider`: `none` — skip Phase 4.

---

## Phase 5 — Data and content

### 5a — Load a demo pack by link

Packs: `demo/<id>/pack.json` + city JSON. Schema: `data/schema/pack.schema.json`. Details: [`demo/README.md`](demo/README.md).

**Shell:**

```bash
npm run demo -- london
npm run demo -- https://github.com/mauzon/travel/tree/main/demo/london
```

**GitHub API only:** fetch `https://raw.githubusercontent.com/mauzon/travel/main/demo/london/pack.json` and each `files[].path`; write `target` paths; write `config.json` from manifest `config`.

After load:

```bash
node scripts/instance.mjs set site.loadedPacks '["london"]'
node scripts/instance.mjs set site.defaultCity london
```

**Remove demo:**

```bash
npm run demo -- remove london
# or npm run demo -- clear
```

### 5b — Import a Google Maps saved list

**ASK HUMAN:** shared list URL (`https://maps.app.goo.gl/…` or full Google Maps list link). Store in `config.json` → `googleList` only in **private** repo.

```bash
OUTPUT=data/cache/list.json node scripts/extract-list.mjs "<LIST_URL>"
node scripts/filter-city.mjs data/cache/list.json --lat LAT --lng LNG --radius-km KM > data/cache/<slug>-places.json
node scripts/merge-city.mjs --city <slug> --places data/cache/<slug>-places.json
# Then categorize places; set city.source.filter = { lat, lng, radius_km } so sync-list works later
```

Set `source: "list"` and preserve **`user_note`** from the list forever (sync must not overwrite with agent text).

**User-facing notes:** the list must be shared as "anyone with the link" (works for collaborative/group lists too). If extraction returns 0 items, ask the human to check sharing. One list can feed several cities — each city keeps only places inside its `source.filter` radius. Extra lists can be imported once with the same pipeline; only `config.googleList` is re-synced by `sync-list`.

**Re-sync later** ("sync my Google Maps list again"): `node scripts/sync-list.mjs --city <slug>` (dry run, show the diff to the human) → `--apply` → enrich-routes → validate → push.

**Maps outbound links:** Never put a Knowledge Graph `/g/…` MID in `place_id` (Maps shows “No results”). Use **`lib/google-maps-links.mjs`** for every `maps_url` (priority: `?cid=` from list feature id → real `query_place_id` → preserved share URL → name search). Store `google.cid`, `google.place_id`, `google.mid`, `google.maps_url` on places; run `npm run fix:maps-links` after bulk fixes and `npm run check:maps-links` in CI. Full rules: **`docs/google-maps-links.md`**.

### 5c — Add city / place / event / origin

| Task | Command / action |
|------|------------------|
| New city | `node scripts/new-city.mjs <slug> --name "…" --country XX` |
| Add origin | `npm run add-origin -- --city <slug> --id … --label-en … --lat … --lng …` |
| Routes | `node scripts/enrich-routes.mjs data/cities/<slug>.json [--force]` |
| Public transit | `npm run enrich-transit -- data/cities/<slug>.json [--force]` — see `routing.transit` below |
| Resync list | `node scripts/sync-list.mjs --city <slug>` then `--apply` |
| Validate + build | `npm run validate && npm run build` |

**Provenance**

| `source` | Meaning |
|----------|---------|
| `list` | From Google Maps list |
| `added` | Agent/user pick |
| `event` | Scheduled event row |

- **`user_note`** — from list; never replace with `description`.
- **`description` / `description_en`** — agent-written context.

**Public transit (`routing.transit` on the city file)**

| Value | Use |
|-------|-----|
| `tfl` | London demo: `npm run enrich-transit -- data/cities/<slug>.json` calls the TfL Journey Planner (weekday `hotel.stay.check_in` at 11:00 by default). Writes `routes[<originId>].transit` with `min`, `description` / `description_en`, `mode`. Cache: `data/cache/transit-tfl.json` (gitignored). Optional env: `TFL_APP_KEY`, `TFL_DELAY_MS` (default 350). |
| `manual` | No API. Agents copy times from official transit sites into each `transit` leg (and per-origin `routes`). |
| `none` / omitted | No enrichment script; leave transit blank or fill manually. |

Hotel copy: `hotel.transit_description(_en)` — TfL mode also sets nearest stations. Page footer text is fixed in `src/i18n` (no per-city override).

### 5d — Commit and deploy

```bash
git add data/cities config.json .travel/instance.json
git commit -m "Load London demo pack and update instance state"
git push origin main
```

Git-linked hosts redeploy on push. CLI-only deploy: rerun host deploy command from Phase 2.

---

## Phase 6 — Ongoing operation

### Instance state file

- **Path:** `.travel/instance.json` (user-specific, **gitignored**)
- **Template:** `.travel/instance.example.json`
- **Schema:** `data/schema/instance.schema.json`
- **CLI:** `node scripts/instance.mjs init | show | set | merge`

Contains: repo URL, host provider, domain, access mode, optional allowed emails, default city, loaded packs. **No secrets.**

Commit `instance.example.json` only in the template; each user’s `instance.json` stays local or in a private repo if they choose to track it.

### Natural language → procedure

After every data change: `npm run validate` → `npm run enrich-routes` (if origins changed) → `npm run enrich-transit` (if `routing.transit` is `tfl` or data edited) → `npm run build` → `npm run test:browser` (optional) → `npm run audit:security` → commit → `git push` → host redeploys.

**Place categories** (use as `category` on places/events; UI labels in `src/i18n/en.ts`): `events`, `food`, `cafe`, `sights`, `markets`, `nightlife`, `shopping`, `spa`, `parks`, `hotels`, `coworking`, `activities`, `uncategorized`. Demo data may use `culture` (shown like sights). The schema allows other strings; there is no `visited` / `favourite` field — use `user_note` / `user_note_en` for status text.

| User says (copy-paste examples) | Agent does |
|---------------------------------|------------|
| “Run a security audit of my travel site” | `npm run audit:security` (add `-- --url https://your-domain` when deployed). Fix fails; commit hardening. Report: `reports/security-audit-<date>.md` (gitignored). |
| “Load the London demo” / link to `…/demo/london` | `npm run demo -- london` or URL; Phase 5a; update `site.loadedPacks`, `site.defaultCity` in instance; validate, build, push |
| “Remove the demo” | `npm run demo -- clear` or `npm run demo -- remove london`; clear `loadedPacks`; validate; push |
| “Add my hotel **Sea View Inn**, **https://maps…**, in **Lisbon** as a starting point” | `npm run add-origin -- --city lisbon --id sea-view --label-en "Sea View Inn" --label-ru "…" --kind hotel --maps-url "https://…"`; `enrich-routes`; validate; push |
| “Add the concert at **The O2** on **15 March 2027 19:30** as a second starting point” | `add-origin` for venue (+ optional `--default`); add event under `events[]` in city JSON (`source: event`, `category: events`, `datetime`); enrich; push |
| “Add **Borough Market** to London as a **market**, note: go hungry” | Append place in `data/cities/london.json`: `category: markets`, `user_note_en`; `source: added`; https `maps_url`; enrich default origin only if needed |
| “Add this list of **5 restaurants** …” | Edit `places[]` (batch JSON); categories `food`; validate; push |
| “Add the event **X** on **date Y** at **place Z**” | Event object in `events[]`; link `venue_id` / coords as per schema; enrich; push |
| “Change **Borough Market** to category **food**” / “Update the note on …” | Edit place fields in city JSON; validate; push (no enrich unless origins changed) |
| “Rename the origin label for **hotel** to …” | Edit `origins[].label_en` / `label_ru`; validate; push |
| “Set **hotel** as the default starting point” | `npm run set-default-origin -- --city <slug> --id <origin-id>`; push |
| “Remove **Borough Market**” | `npm run remove-place -- --city london --id borough-market` |
| “Remove origin **concert-o2**” | `npm run remove-origin -- --city london --id concert-o2 --enrich` |
| “Remove the whole city **lisbon**” | `npm run remove-city -- --slug lisbon --prune-cache`; fix `config.json` if script did not |
| “Import my Maps list” | **ASK HUMAN** for URL; Phase 5b; set `googleList`; push (private repo) |
| “Switch default city to …” | Edit `config.json` `defaultCity` + `cities[]`; instance `site.defaultCity`; build; push |
| “Default language Russian/English” | `config.json` `defaultLang`; instance `site.defaultLang`; push |
| “Add allowed email …” | Phase 4: Cloudflare Access / host protection; optional `accessControl.allowedEmails` in instance |
| “Redeploy” | Push to `main`, or host redeploy button, or CLI from Phase 2 |

Always: read `.travel/instance.json` → perform steps → update `updatedAt` → validate → build → audit when security-related → push.

### Troubleshooting

| Symptom | Check |
|---------|--------|
| Empty landing page | `config.json` has no cities — load pack or add city JSON |
| `validate` fails | `npm run validate` errors; fix against `data/schema/city.schema.json` |
| Build fails | `npm ci`; Node 22; missing `data/cities/<defaultCity>.json` |
| 404 on host | Output must be `dist/`; SPA: Railway `serve -s`; CF `not_found_handling` in `wrangler.jsonc` |
| Routes missing | Run `enrich-routes` (needs network for OSRM); commit city JSON |
| List sync wrong | Run sync dry-run first; never overwrite `user_note` unintentionally |
| Access loop | Cloudflare Access policy domain must match live URL |
| Agent can’t push | **ASK HUMAN** for fork write access or PAT via secure channel |

---

## Reference — scripts

| Script | Role |
|--------|------|
| `npm run demo -- <id\|url>` | Load data pack |
| `npm run demo -- remove <id>` / `clear` | Unload |
| `npm run validate` | City + pack + instance schema; https URL checks |
| `npm run build` | Static site to `dist/` (+ `dist/_headers`) |
| `npm run test:browser` | Playwright smoke + offline PWA check |
| `npm run test:offline` | Playwright: SW precache, reload offline, place cards visible |
| `npm run audit:security` | Security/privacy report in `reports/` |
| `npm run remove-place` | Drop place or event by id |
| `npm run remove-origin` | Drop origin + route keys; optional `--enrich` |
| `npm run remove-city` | Delete city file; update config; optional `--prune-cache` |
| `npm run set-default-origin` | Mark default reference point |
| `scripts/extract-list.mjs` | Google list → JSON |
| `scripts/filter-city.mjs` | Filter by radius |
| `scripts/merge-city.mjs` | Merge extract into city |
| `scripts/sync-list.mjs` | Sync list ↔ city |
| `lib/google-maps-links.mjs` | Canonical Maps URL builder (CID / place_id / preserved link) |
| `scripts/check-maps-links.mjs` | Validate outbound Maps links |
| `scripts/fix-maps-links.mjs` | Recompute `google.*` + `maps_url` in city/demo JSON |
| `scripts/enrich-routes.mjs` | OSRM + taxi estimates |
| `scripts/enrich-transit.mjs` | Public transit legs (TfL provider; optional) |
| `scripts/add-origin.mjs` | New reference point |
| `scripts/new-city.mjs` | Scaffold city + config |
| `scripts/instance.mjs` | Instance state CRUD |

---

## Offline PWA

`build.mjs` writes `dist/sw.js` (via `scripts/lib/generate-sw.mjs`): versioned cache, precache of all built files + `data/cities/*.json`, `skipWaiting` + `clients.claim`. Fetch: **network-first** (3s timeout) for HTML navigations and `/data/*.json`, with fallback to cache on network errors, timeouts, redirects, 401/403, or Cloudflare Access redirects; **cache-first** for icons/manifest. Registration in `src/pwa-client.ts` (production bundle). **Reload** (`src/pwa-reload.ts`): online → `registration.update()`, clear `travel-places-*` caches, reload; offline → plain reload without wiping cache. UI: offline banner + “Updated” toast (`src/i18n/*`). `dist/_headers`: `/sw.js` → `Cache-Control: no-cache`, `Service-Worker-Allowed: /`.

**Works offline:** place list, filters, cards, theme/lang. **Does not:** Google Maps links/tiles. **Access-protected deploys:** expired Access sessions may redirect; cached HTML keeps the app usable until the user re-authenticates for fresh deploys.

---

## Reference — keep personal data out of public repos

- No real hotels, dates, private list URLs, emails, or access policy IDs in **public** commits.
- Demo packs in `demo/` are fictional/public coordinates only.
- User trip data: **private fork** + optional private `instance.json`.
