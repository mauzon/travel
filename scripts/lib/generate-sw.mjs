import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SW_SOURCE = String.raw`"use strict";

const VERSION = __VERSION__;
const CACHE = "travel-places-" + VERSION;
const PRECACHE = __PRECACHE__;
const NETWORK_TIMEOUT_MS = 3000;
const ACCESS_HOST_RE = /cloudflareaccess\\.com/i;

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isDataJson(url) {
  return url.pathname.endsWith(".json") || url.pathname.startsWith("/data/");
}

function isCacheFirstPath(url) {
  if (url.pathname === "/sw.js") return true;
  if (url.pathname === "/site.webmanifest") return true;
  if (/\\.(png|ico|svg|webp|woff2?)$/i.test(url.pathname)) return true;
  return false;
}

function shouldUseNetwork(url, request) {
  return isHtmlNavigation(request) || isDataJson(url);
}

function badNetworkResponse(response) {
  if (!response) return true;
  if (response.type === "opaqueredirect") return true;
  if (response.status === 0) return true;
  if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
    return true;
  }
  if (response.status === 401 || response.status === 403) return true;
  if (response.redirected && ACCESS_HOST_RE.test(response.url || "")) return true;
  return false;
}

function okToCache(response) {
  return response && response.status === 200 && response.type === "basic";
}

async function readCache(request) {
  const cache = await caches.open(CACHE);
  const match = await cache.match(request);
  if (match) return match;
  if (request.mode === "navigate") {
    return (await cache.match("/index.html")) || (await cache.match("index.html"));
  }
  return null;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch(request, { redirect: "manual", signal: controller.signal });
    clearTimeout(timer);
    if (!badNetworkResponse(response) && okToCache(response)) {
      cache.put(request, response.clone());
      return response;
    }
    if (cached) return cached;
    if (badNetworkResponse(response) && cached) return cached;
  } catch (e) {
    clearTimeout(timer);
    if (cached) return cached;
  }
  const fallback = await readCache(request);
  if (fallback) return fallback;
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request, { redirect: "manual" });
    if (okToCache(response)) {
      cache.put(request, response.clone());
      return response;
    }
  } catch (e) {
    /* ignore */
  }
  const fallback = await readCache(request);
  if (fallback) return fallback;
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch (e) {
            console.warn("[sw] precache failed", url, e);
          }
        }),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("travel-places-") && k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isCacheFirstPath(url) && !shouldUseNetwork(url, request)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (shouldUseNetwork(url, request)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
`;

export function collectDistUrls(distDir) {
  const urls = [];
  const skip = new Set(["_headers", ".gitkeep"]);
  const walk = (rel) => {
    const abs = path.join(distDir, rel);
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (ent.name.startsWith(".")) continue;
      const sub = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(sub);
      else if (!skip.has(ent.name) && ent.name !== "sw.js") {
        urls.push("/" + sub.replace(/\\/g, "/"));
      }
    }
  };
  walk("");
  if (!urls.includes("/sw.js")) urls.push("/sw.js");
  return [...new Set(urls)].sort();
}

export function writeServiceWorker(distDir, extraUrls = []) {
  const manifest = [...new Set([...collectDistUrls(distDir), ...extraUrls])].sort();
  const version = crypto.createHash("sha256").update(manifest.join("\n")).digest("hex").slice(0, 16);
  const final = SW_SOURCE.replace("__VERSION__", JSON.stringify(version)).replace(
    "__PRECACHE__",
    JSON.stringify(manifest),
  );
  fs.writeFileSync(path.join(distDir, "sw.js"), final);
  console.log(`wrote dist/sw.js (v=${version}, ${manifest.length} URLs)`);
  return { version, manifest };
}

export function copyCityJsonToDist(root, distDir, config) {
  if (!config.cities?.length) return [];
  const outDir = path.join(distDir, "data/cities");
  fs.mkdirSync(outDir, { recursive: true });
  const added = [];
  for (const city of config.cities) {
    const src = path.join(root, "data/cities", `${city.slug}.json`);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(outDir, `${city.slug}.json`);
    fs.copyFileSync(src, dest);
    added.push(`/data/cities/${city.slug}.json`);
  }
  return added;
}