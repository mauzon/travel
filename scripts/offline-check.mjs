#!/usr/bin/env node
/**
 * Verify PWA offline: service worker precache + offline reload shows places.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(root, "dist");

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".webmanifest")) return "application/manifest+json";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function makeServer() {
  return createServer((req, res) => {
    let url = req.url?.split("?")[0] || "/";
    if (url.endsWith("/")) url += "index.html";
    const rel = url === "/index.html" ? "index.html" : url.replace(/^\//, "");
    const file = path.join(distRoot, rel);
    const safe = path.normalize(file);
    if (!safe.startsWith(distRoot) || !fs.existsSync(safe) || fs.statSync(safe).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const headers = { "Content-Type": contentType(safe) };
    if (rel === "sw.js") {
      headers["Service-Worker-Allowed"] = "/";
      headers["Cache-Control"] = "no-cache";
    }
    res.writeHead(200, headers);
    res.end(fs.readFileSync(safe));
  });
}

async function main() {
  if (!fs.existsSync(path.join(distRoot, "index.html"))) {
    console.error("dist/ missing — run npm run demo:london && npm run build first");
    process.exit(1);
  }
  if (!fs.existsSync(path.join(distRoot, "sw.js"))) {
    console.error("dist/sw.js missing — rebuild with service worker generation");
    process.exit(1);
  }

  const server = makeServer();
  const port = await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
  const base = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();

  try {
    await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 45000 });
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator(".place-card").first().waitFor({ state: "visible", timeout: 15000 });
    const count = await page.locator(".place-card").count();
    if (count < 3) throw new Error(`expected place cards offline, got ${count}`);
    console.log(`offline-check OK (${count} place cards visible)`);
  } catch (e) {
    console.error("offline-check FAILED:", e.message || e);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv.includes("--prepare")) {
  execSync("npm run demo:london", { cwd: root, stdio: "inherit" });
  execSync("npm run build", { cwd: root, stdio: "inherit" });
}

await main();