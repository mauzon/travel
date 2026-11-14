import { chromium, webkit, devices } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(scriptDir, "..");
const distRoot = path.join(root, "dist");
const artifactDir = "/opt/cursor/artifacts";
const docsShotDir = path.join(root, "docs", "screenshots");

fs.mkdirSync(artifactDir, { recursive: true });
fs.mkdirSync(docsShotDir, { recursive: true });

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function makeServer() {
  return createServer((req, res) => {
    let url = req.url?.split("?")[0] || "/";
    if (url.endsWith("/")) url += "index.html";
    const file = path.join(distRoot, url === "/index.html" ? "index.html" : url.slice(1));
    const safe = path.normalize(file);
    if (!safe.startsWith(distRoot) || !fs.existsSync(safe) || fs.statSync(safe).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(safe) });
    res.end(fs.readFileSync(safe));
  });
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

const errors = [];

async function assertFiltersLayout(page, width, theme, outErrors, { saveDocs = false } = {}) {
  const filtersEl = page.locator(".filters-controls");
  if ((await filtersEl.count()) === 0) return;
  await filtersEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const sortSel = page.locator('[data-testid="sort-select"]');
  const searchInput = page.locator(".filters-search-cell input");
  if ((await sortSel.count()) === 0 || (await searchInput.count()) === 0) return;

  const sortBox = await sortSel.boundingBox();
  const searchBox = await searchInput.boundingBox();
  const fBox = await filtersEl.boundingBox();
  if (!sortBox || !searchBox || !fBox) return;

  const tag = `${width}px-${theme}`;

  if (width >= 640) {
    if (Math.abs(sortBox.y - searchBox.y) > 6) {
      outErrors.push({
        name: `filters-layout-row-${tag}`,
        consoleMsgs: [`sort/search not same row: sortY=${sortBox.y} searchY=${searchBox.y}`],
      });
    }
    const half = fBox.width / 2;
    if (sortBox.width < half * 0.35 || searchBox.width < half * 0.35) {
      outErrors.push({
        name: `filters-layout-half-${tag}`,
        consoleMsgs: [`filters not ~50/50: sortW=${sortBox.width} searchW=${searchBox.width} filtersW=${fBox.width}`],
      });
    }
    const truncated = await sortSel.evaluate((el) => {
      const opt = el.selectedOptions[0];
      const label = opt?.text ?? el.value;
      return label.length > 12 && el.scrollWidth > el.clientWidth + 4;
    });
    if (truncated) {
      outErrors.push({
        name: `filters-sort-truncate-${tag}`,
        consoleMsgs: ["sort select label truncated at desktop width"],
      });
    }
  } else {
    if (searchBox.width < fBox.width - 8) {
      outErrors.push({
        name: `filters-search-width-${tag}`,
        consoleMsgs: [`search not full width: ${searchBox.width} vs ${fBox.width}`],
      });
    }
    if (Math.abs(sortBox.y - searchBox.y) < 8) {
      outErrors.push({
        name: `filters-stack-${tag}`,
        consoleMsgs: [`search should be below sort on mobile: y diff ${Math.abs(sortBox.y - searchBox.y)}`],
      });
    }
  }

  const shotDir = saveDocs ? docsShotDir : artifactDir;
  const shotPath = path.join(shotDir, `filters-row-${width}px-${theme}.png`);
  await page.screenshot({
    path: shotPath,
    clip: {
      x: 0,
      y: Math.max(0, fBox.y - 8),
      width,
      height: Math.min(900, Math.ceil(fBox.height + 16)),
    },
  });
  console.log(`screenshot ${shotPath}`);
}

async function checkEmpty() {
  console.log("--- empty site ---");
  run("npm run demo:clear");
  run("npm run build");
  const server = makeServer();
  const port = await listen(server);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  const text = await page.locator("h1").innerText();
  if (!/no cities yet/i.test(text)) {
    errors.push({ name: "empty-site", consoleMsgs: [`expected empty headline, got: ${text}`] });
  }
  await browser.close();
  server.close();
}

async function checkLondon() {
  console.log("--- london demo ---");
  run("npm run demo:london");
  run("npm run validate");
  run("npm run build");

  const cityPath = path.join(root, "data/cities/london.json");
  const city = JSON.parse(fs.readFileSync(cityPath, "utf8"));
  const firstPlace = city.places[0];

  const server = makeServer();
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();

  async function shotPage(name, url, width, saveReadme) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: "light" });
    await page.addInitScript(() => localStorage.removeItem("travel-top-nav-collapsed"));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 10000 });
    await page.locator('[data-testid="top-nav-bar"]').waitFor({ state: "visible", timeout: 8000 });
    const out = path.join(artifactDir, `${name}.png`);
    if (saveReadme) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const readmePath = path.join(docsShotDir, `${name}.png`);
      await page.screenshot({ path: readmePath, clip: { x: 0, y: 0, width, height: Math.min(720, 900) } });
      console.log(`screenshot ${readmePath}`);
    }
    await page.screenshot({ path: out, fullPage: true });
    console.log(`screenshot ${out}`);
    await page.close();
  }

  await shotPage("london-en-light-1280px", `${base}/`, 1280, true);
  await shotPage("london-en-light-375px", `${base}/`, 375, true);

  for (const theme of ["light", "dark"]) {
    const layoutPage = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
    });
    await layoutPage.addInitScript((scheme) => {
      localStorage.removeItem("travel-top-nav-collapsed");
      localStorage.setItem("travel-color-scheme", scheme);
    }, theme);
    await layoutPage.goto(`${base}/`, { waitUntil: "networkidle" });
    await layoutPage.locator('[data-testid="sort-select"]').waitFor({ state: "visible", timeout: 10000 });
    await assertFiltersLayout(layoutPage, 1280, theme, errors, { saveDocs: true });
    await layoutPage.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  await page.addInitScript(() => {
    window.__lastShare = null;
    navigator.share = async (data) => {
      window.__lastShare = data;
    };
  });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const shareBtn = page.locator("button.share-btn").first();
  await shareBtn.click();
  await page.waitForFunction(() => window.__lastShare != null, { timeout: 5000 });
  const payload = await page.evaluate(() => window.__lastShare);
  const mapsOk =
    payload?.url?.includes("google.com/maps") ||
    payload?.url?.includes("maps.google.com");
  if (!mapsOk) {
    errors.push({ name: "london-share", consoleMsgs: [`invalid share url: ${payload?.url}`] });
  }

  const sel = page.locator('[data-testid="sort-select"]');
  await sel.selectOption("distance:concert-o2");
  await page.waitForTimeout(300);
  const label = await page.locator(".routes-from-label").first().innerText();
  if (!/o2/i.test(label)) {
    errors.push({ name: "london-origin", consoleMsgs: [`origin label: ${label}`] });
  }

  if (!(await page.content()).includes(firstPlace.name_en || firstPlace.name)) {
    errors.push({ name: "london-content", consoleMsgs: [`missing place ${firstPlace.name_en}`] });
  }

  const html = await page.content();
  if (/lisbon/i.test(html)) {
    errors.push({ name: "london-no-lisbon", consoleMsgs: ["page HTML contains Lisbon"] });
  }
  const distHtml = fs.readFileSync(path.join(distRoot, "index.html"), "utf8");
  if (/lisbon/i.test(distHtml)) {
    errors.push({ name: "dist-no-lisbon", consoleMsgs: ["dist/index.html contains Lisbon"] });
  }

  const sampleTransit =
    firstPlace.routes?.hotel?.transit?.description_en ||
    firstPlace.transit?.description_en ||
  "";
  if (!sampleTransit) {
    errors.push({ name: "london-transit", consoleMsgs: ["no transit on first place from hotel origin"] });
  } else if (!html.includes(sampleTransit.slice(0, 12))) {
    errors.push({
      name: "london-transit-ui",
      consoleMsgs: [`transit not visible in HTML: expected snippet from ${sampleTransit.slice(0, 40)}`],
    });
  }

  const transitCell = page.locator(".travel-cell").filter({ hasText: /line|bus|walk/i }).first();
  if ((await transitCell.count()) === 0) {
    errors.push({ name: "london-transit-cell", consoleMsgs: ["no transit travel cell with route text"] });
  }

  await page.close();

  await checkWebKitIphone(server, base, errors);
  await checkCollapsedNavWebKit(server, base, errors);

  await browser.close();
  server.close();
}

async function checkWebKitIphone(server, base, outErrors) {
  console.log("--- webkit iphone ---");
  let browser;
  try {
    browser = await webkit.launch();
  } catch (e) {
    outErrors.push({ name: "webkit-launch", consoleMsgs: [String(e.message || e)] });
    return;
  }

  const iphone = devices["iPhone 13"];
  const webkitWidth = 375;

  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({
      ...iphone,
      viewport: { width: webkitWidth, height: 812 },
      colorScheme: scheme,
    });
    const page = await context.newPage();
    await page.addInitScript((s) => {
      localStorage.removeItem("travel-top-nav-collapsed");
      localStorage.setItem("travel-color-scheme", s);
    }, scheme);
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="top-nav-bar"]').waitFor({ state: "visible", timeout: 10000 });

    const assertNoHorizontalOverflow = async (label) => {
      const sizes = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (sizes.scrollWidth > sizes.clientWidth) {
        outErrors.push({
          name: `webkit-horizontal-overflow-${scheme}-${label}`,
          consoleMsgs: [`scrollWidth ${sizes.scrollWidth} > clientWidth ${sizes.clientWidth}`],
        });
      }
    };
    await assertNoHorizontalOverflow("top");

    const reloadBtn = page.locator('[data-testid="reload-btn"]');
    const themeBtn = page.locator('[data-testid="theme-switcher"]');
    if ((await reloadBtn.count()) && (await themeBtn.count())) {
      const rb = await reloadBtn.boundingBox();
      const tb = await themeBtn.boundingBox();
      if (rb && tb) {
        if (Math.abs(rb.y - tb.y) > 4) {
          outErrors.push({
            name: `webkit-reload-align-${scheme}`,
            consoleMsgs: [`reload/theme row misaligned: y ${rb.y} vs ${tb.y}`],
          });
        }
        const h = rb.height;
        if (h < 42 || h > 46) {
          outErrors.push({
            name: `webkit-reload-size-${scheme}`,
            consoleMsgs: [`reload btn height ${h}px`],
          });
        }
      }
    }

    const selectStyles = await page.locator(".top-nav-bar select").first().evaluate((el) => {
      const st = getComputedStyle(el);
      return {
        color: st.color,
        backgroundColor: st.backgroundColor,
        appearance: st.getPropertyValue("-webkit-appearance") || st.appearance,
      };
    });
    const parse = (s) => {
      const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    };
    const fg = parse(selectStyles.color);
    const bg = parse(selectStyles.backgroundColor);
    if (fg && bg) {
      const diff = Math.abs(fg[0] - bg[0]) + Math.abs(fg[1] - bg[1]) + Math.abs(fg[2] - bg[2]);
      if (diff < 80) {
        outErrors.push({
          name: `webkit-select-contrast-${scheme}`,
          consoleMsgs: [`low fg/bg contrast: ${JSON.stringify(selectStyles)}`],
        });
      }
    }

    await page.evaluate(() => document.querySelector(".filters-controls")?.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(200);
    await assertFiltersLayout(page, webkitWidth, scheme, outErrors);

    const name = `london-webkit-${scheme}-375-top-filters`;
    const shotPath = path.join(docsShotDir, `${name}.png`);
    const clipH = 780;
    await page.screenshot({
      path: shotPath,
      clip: { x: 0, y: 0, width: webkitWidth, height: clipH },
    });

    await page.evaluate(() => {
      const firstCard = document.querySelector(".place-card");
      firstCard?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(150);
    await assertNoHorizontalOverflow("place-card");

    for (const sel of await page.locator(".top-nav-bar select, .filters-controls select").all()) {
      const appearance = await sel.evaluate((el) => getComputedStyle(el).webkitAppearance || getComputedStyle(el).appearance);
      if (appearance === "menulist-button" || appearance === "menulist") {
        outErrors.push({
          name: `webkit-menulist-${scheme}`,
          consoleMsgs: [`select still native: ${appearance}`],
        });
        break;
      }
    }

    const clipCheck = await page.locator(".top-nav-bar select").first().evaluate((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const textRect = range.getBoundingClientRect();
      const padTop = Number.parseFloat(st.paddingTop) || 0;
      const padBot = Number.parseFloat(st.paddingBottom) || 0;
      const innerTop = r.top + padTop;
      const innerBot = r.bottom - padBot;
      const clipped =
        textRect.height > 0 && (textRect.bottom > innerBot + 1 || textRect.top < innerTop - 1);
      return {
        clipped,
        appearance: st.getPropertyValue("-webkit-appearance") || st.appearance,
        menulist: (st.getPropertyValue("-webkit-appearance") || st.appearance) === "menulist",
      };
    });
    if (clipCheck.clipped || clipCheck.menulist) {
      outErrors.push({
        name: `webkit-select-layout-${scheme}`,
        consoleMsgs: [JSON.stringify(clipCheck)],
      });
    }
    console.log(`screenshot ${shotPath}`);

    const themeToggle = page.locator('[data-testid="theme-switcher"]');
    const before = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await themeToggle.click();
    await page.waitForFunction(
      (prev) => document.documentElement.getAttribute("data-theme") !== prev,
      before,
      { timeout: 3000 },
    );
    const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    if (after === before) {
      outErrors.push({ name: `webkit-theme-toggle-${scheme}`, consoleMsgs: [`theme stuck: ${before}`] });
    }

    await context.close();
  }
  await browser.close();
}

async function checkCollapsedNavWebKit(server, base, outErrors) {
  console.log("--- webkit collapsed nav ---");
  let browser;
  try {
    browser = await webkit.launch();
  } catch (e) {
    outErrors.push({ name: "webkit-collapsed-launch", consoleMsgs: [String(e.message || e)] });
    return;
  }
  const width = 375;
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: { width, height: 812 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("travel-top-nav-collapsed", "1");
    localStorage.setItem("travel-color-scheme", "light");
  });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.locator('[data-testid="top-nav-fab"]').waitFor({ state: "visible", timeout: 10000 });
  if ((await page.locator('[data-testid="top-nav-bar"]').count()) > 0) {
    outErrors.push({
      name: "webkit-collapsed-no-bar",
      consoleMsgs: ["top-nav-bar still visible when collapsed"],
    });
  }

  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const doc = document.documentElement;
    return {
      h1Top: h1?.getBoundingClientRect().top ?? null,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      topNavOffset: getComputedStyle(doc).getPropertyValue("--top-nav-offset").trim(),
    };
  });

  if (metrics.h1Top == null || metrics.h1Top > 24) {
    outErrors.push({
      name: "webkit-collapsed-h1-top",
      consoleMsgs: [`expected h1 top <= 24px, got ${metrics.h1Top}`],
    });
  }
  if (metrics.scrollWidth > metrics.clientWidth) {
    outErrors.push({
      name: "webkit-collapsed-overflow",
      consoleMsgs: [`scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`],
    });
  }
  if (metrics.topNavOffset !== "0px" && metrics.topNavOffset !== "0") {
    outErrors.push({
      name: "webkit-collapsed-offset",
      consoleMsgs: [`expected --top-nav-offset 0, got ${metrics.topNavOffset}`],
    });
  }

  await context.close();
  await browser.close();
}

await checkEmpty();
await checkLondon();

if (errors.length) {
  console.error("Errors:", JSON.stringify(errors, null, 2));
  process.exit(1);
}
console.log("browser check OK (empty + london)");
