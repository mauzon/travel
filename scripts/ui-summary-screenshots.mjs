import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(scriptDir, "..", "dist");
const artifactDir = "/opt/cursor/artifacts";
fs.mkdirSync(artifactDir, { recursive: true });

const server = createServer((req, res) => {
  let url = req.url?.split("?")[0] || "/";
  if (url.endsWith("/")) url += "index.html";
  const file = path.join(distRoot, url === "/index.html" ? "index.html" : url.slice(1));
  const safe = path.normalize(file);
  if (!safe.startsWith(distRoot) || !fs.existsSync(safe) || fs.statSync(safe).isDirectory()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(fs.readFileSync(safe));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();

for (const { width, theme } of [
  { width: 1280, theme: "light" },
  { width: 1280, theme: "dark" },
  { width: 390, theme: "light" },
  { width: 390, theme: "dark" },
]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
  await page.addInitScript((scheme) => {
    localStorage.removeItem("travel-top-nav-collapsed");
    localStorage.setItem("travel-color-scheme", scheme);
  }, theme);
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 10000 });

  await page.evaluate(() => window.scrollTo(0, 0));
  const navCollapsed = path.join(artifactDir, `bangkok-nav-collapsed-${theme}-${width}px.png`);
  await page.locator('[data-testid="top-nav-collapse"]').click();
  await page.waitForSelector('[data-testid="top-nav-fab"]', { timeout: 5000 });
  await page.screenshot({
    path: navCollapsed,
    clip: { x: Math.max(0, width - 120), y: 0, width: 120, height: 80 },
  });
  console.log(navCollapsed);
  await page.locator('[data-testid="top-nav-fab"]').click();
  await page.waitForSelector('[data-testid="top-nav-bar"]', { timeout: 5000 });

  const collapsed = path.join(artifactDir, `bangkok-summary-collapsed-${theme}-${width}px.png`);
  await page.screenshot({ path: collapsed, clip: { x: 0, y: 0, width, height: Math.min(560, 900) } });
  console.log(collapsed);

  await page.locator('[data-testid="page-summary-toggle"]').click();
  await page.waitForTimeout(200);
  const expanded = path.join(artifactDir, `bangkok-summary-expanded-${theme}-${width}px.png`);
  await page.screenshot({ path: expanded, clip: { x: 0, y: 0, width, height: Math.min(720, 900) } });
  console.log(expanded);

  const card = path.join(artifactDir, `bangkok-place-card-${theme}-${width}px.png`);
  await page.evaluate(() => window.scrollTo(0, 520));
  await page.waitForTimeout(150);
  await page.locator(".source-icon-badge, .status").first().waitFor({ timeout: 8000 });
  await page.screenshot({ path: card, clip: { x: 0, y: 0, width, height: Math.min(420, 900) } });
  console.log(card);

  const fullPage = path.join(artifactDir, `bangkok-theme-full-${theme}-${width}px.png`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: fullPage, fullPage: false, clip: { x: 0, y: 0, width, height: Math.min(900, 900) } });
  console.log(fullPage);

  await page.close();
}

await browser.close();
server.close();
console.log("summary screenshots OK");
