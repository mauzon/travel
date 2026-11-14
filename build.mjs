import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LANG,
  langRedirectScript,
  legacyEnPath,
  legacyEnRedirectHtml,
  pagePath,
} from "./scripts/locale-paths.mjs";
import { escapeHtml } from "./scripts/lib/html-escape.mjs";
import { netlifyHeadersBlock } from "./scripts/lib/security-headers.mjs";
import { copyCityJsonToDist, writeServiceWorker } from "./scripts/lib/generate-sw.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, "dist");
const config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
const tmpJs = "/tmp/travel-app.js";
const defaultLang = config.defaultLang === "ru" ? "ru" : DEFAULT_LANG;
const publicDir = path.join(root, "public");

function copyPublicAssets() {
  if (!fs.existsSync(publicDir)) return;
  for (const name of fs.readdirSync(publicDir)) {
    if (name === "sw.js") continue;
    fs.copyFileSync(path.join(publicDir, name), path.join(distDir, name));
  }
}

function finalizeDist() {
  copyCityJsonToDist(root, distDir, config);
  writeServiceWorker(distDir);
  fs.writeFileSync(path.join(distDir, "_headers"), netlifyHeadersBlock());
  console.log("wrote dist/_headers (Cloudflare / Netlify)");
}

function iconHeadTags(locale) {
  const appTitle = escapeHtml(
    locale === "en" ? config.siteTitle_en || "Travel places" : config.siteTitle || "Travel places",
  );
  return `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#F7F7F5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${appTitle}">`;
}

function hreflangLinks(slug) {
  return [
    { lang: "en", href: pagePath("en", slug, config.defaultCity) },
    { lang: "ru", href: pagePath("ru", slug, config.defaultCity) },
    { lang: "x-default", href: pagePath(defaultLang, slug, config.defaultCity) },
  ];
}

async function buildCityHtml(slug, outRelDir, locale) {
  const cityPath = path.join(root, "data/cities", `${slug}.json`);
  const cityData = JSON.parse(fs.readFileSync(cityPath, "utf8"));

  fs.writeFileSync(path.join(root, "src/city-data.json"), JSON.stringify(cityData));
  const siteConfig = {
    ...config,
    cities: config.cities.map((c) => {
      const data = JSON.parse(fs.readFileSync(path.join(root, "data/cities", `${c.slug}.json`), "utf8"));
      return {
        ...c,
        count: data.places.length + data.events.length,
        dates:
          locale === "en"
            ? formatStayEn(data.hotel.stay, data.timezone)
            : formatStayRu(data.hotel.stay, data.timezone),
      };
    }),
  };
  fs.writeFileSync(path.join(root, "src/site-config.json"), JSON.stringify(siteConfig));
  fs.writeFileSync(
    path.join(root, "src/build-meta.json"),
    JSON.stringify({
      currentSlug: slug,
      locale,
      defaultCity: config.defaultCity,
      isRootPage:
        slug === config.defaultCity &&
        ((locale === "en" && outRelDir === ".") || (locale === "ru" && outRelDir === "ru")),
      alternates: hreflangLinks(slug),
    }),
  );

  await esbuild.build({
    entryPoints: [path.join(root, "src/main.tsx")],
    bundle: true,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    outfile: tmpJs,
    jsx: "automatic",
    legalComments: "none",
    loader: { ".json": "json" },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });

  const js = fs.readFileSync(tmpJs, "utf8").replace(/<\/script/gi, "<\\/script");
  const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
  const canonical = pagePath(locale, slug, config.defaultCity);
  const cityNameRaw = locale === "en" ? cityData.name_en || cityData.name_ru : cityData.name_ru;
  const cityName = escapeHtml(cityNameRaw);
  const titleSuffix = locale === "en" ? "places" : "места";
  const altTags = hreflangLinks(slug)
    .map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.lang)}" href="${escapeHtml(a.href)}">`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer-when-downgrade">
<link rel="canonical" href="${escapeHtml(canonical)}">
${altTags}
${iconHeadTags(locale)}
<title>${cityName} — ${titleSuffix}</title>
<script>${langRedirectScript(locale, config.defaultCity)}</script>
<script>
(function () {
  try {
    var pref = localStorage.getItem("travel-color-scheme");
    var dark =
      pref === "dark" ||
      (pref !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var kind = dark ? "dark" : "light";
    var root = document.documentElement;
    root.setAttribute("data-theme", kind);
    root.style.colorScheme = kind;
    var bg = dark ? "#111111" : "#F7F7F5";
    var fg = dark ? "#F4F4F0" : "#171717";
    root.style.background = bg;
    if (localStorage.getItem("travel-top-nav-collapsed") === "1") {
      root.classList.add("top-nav-collapsed");
      root.style.setProperty("--top-nav-offset", "0px");
    }
    document.addEventListener("DOMContentLoaded", function () {
      document.body.style.background = bg;
      document.body.style.color = fg;
    });
  } catch (e) {}
})();
</script>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
try {
  if (localStorage.getItem("travel-top-nav-collapsed") === "1") {
    document.documentElement.classList.add("top-nav-collapsed");
    document.documentElement.style.setProperty("--top-nav-offset", "0px");
  }
} catch (e) {}
</script>
<script>
${js}
</script>
</body>
</html>
`;

  const outDir = path.join(distDir, outRelDir);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "index.html");
  fs.writeFileSync(outFile, html);
  console.log(`wrote ${outFile}`);
}

function formatStayRu(stay, timeZone) {
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timeZone || "UTC",
  });
  return `${fmt.format(new Date(stay.check_in + "T12:00:00"))} – ${fmt.format(new Date(stay.check_out + "T12:00:00"))}`;
}

function formatStayEn(stay, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timeZone || "UTC",
  });
  return `${fmt.format(new Date(stay.check_in + "T12:00:00"))} – ${fmt.format(new Date(stay.check_out + "T12:00:00"))}`;
}

function write404(locale, outDir) {
  const isEn = locale === "en";
  const title = isEn ? "Page not found" : "Страница не найдена";
  const site = isEn ? config.siteTitle_en : config.siteTitle;
  const pick = isEn ? "Pick a city:" : "Выберите город:";
  const home = isEn ? "Home" : "На главную";

  const cityLinks = config.cities
    .map((c) => {
      const label = escapeHtml(isEn ? c.title_en || c.title : c.title);
      const ruHref = escapeHtml(pagePath("ru", c.slug, config.defaultCity));
      const enHref = escapeHtml(pagePath("en", c.slug, config.defaultCity));
      const href = isEn ? enHref : ruHref;
      const other = isEn ? ` <a href="${ruHref}">RU</a>` : ` <a href="${enHref}">EN</a>`;
      return `        <li><a href="${href}">${label}</a>${other}</li>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — ${escapeHtml(site)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem 1.25rem; max-width: 36rem; line-height: 1.5; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } a { color: #8ab4f8; } }
  @media (prefers-color-scheme: light) { body { background: #fafafa; color: #1a1a1a; } a { color: #1558d6; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p>${pick}</p>
  <ul>
${cityLinks}
  </ul>
  <p><a href="${isEn ? "/" : "/ru/"}">${escapeHtml(home)}</a></p>
</body>
</html>`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "404.html"), html);
}

function writeEmptyLanding(locale, outDir) {
  const isEn = locale === "en";
  const title = escapeHtml(isEn ? config.siteTitle_en || "Travel places" : config.siteTitle || "Travel places");
  const headline = escapeHtml(isEn ? "No cities yet" : "Городов пока нет");
  const body = isEn
    ? "Add a JSON file under <code>data/cities/</code>, update <code>config.json</code>, or run <code>npm run demo:london</code> to load the London demo pack."
    : "Добавьте JSON в <code>data/cities/</code>, обновите <code>config.json</code> или выполните <code>npm run demo:london</code>.";
  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 2.5rem 1.25rem; max-width: 36rem; line-height: 1.55; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } a { color: #8ab4f8; } }
  @media (prefers-color-scheme: light) { body { background: #fafafa; color: #1a1a1a; } a { color: #1558d6; } }
</style>
</head>
<body>
  <h1>${headline}</h1>
  <p>${isEn ? body : body}</p>
</body>
</html>`;
  const dir = path.join(distDir, outDir === "." ? "" : outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  console.log(`wrote empty ${locale} landing ${path.join(dir, "index.html")}`);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
copyPublicAssets();

if (!config.cities?.length || !config.defaultCity) {
  writeEmptyLanding("en", ".");
  writeEmptyLanding("ru", "ru");
  write404("en", distDir);
  write404("ru", path.join(distDir, "ru"));
  fs.mkdirSync(path.join(distDir, "en"), { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "en", "index.html"),
    legacyEnRedirectHtml("/", "/en/"),
  );
  finalizeDist();
  console.log("empty site: dist/index.html (no cities configured)");
  process.exit(0);
}

for (const city of config.cities) {
  const enDir = city.slug === config.defaultCity ? "." : city.slug;
  await buildCityHtml(city.slug, enDir, "en");
}
for (const city of config.cities) {
  const ruDir = city.slug === config.defaultCity ? "ru" : path.join("ru", city.slug);
  await buildCityHtml(city.slug, ruDir, "ru");
}

write404("en", distDir);
write404("ru", path.join(distDir, "ru"));

for (const city of config.cities) {
  const target = pagePath("en", city.slug, config.defaultCity);
  const legacy = legacyEnPath(city.slug, config.defaultCity);
  const legacyRel = legacy.replace(/^\//, "").replace(/\/$/, "");
  const legacyDir = path.join(distDir, legacyRel);
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, "index.html"), legacyEnRedirectHtml(target, legacy));
}
const rootLegacy = legacyEnPath(config.defaultCity, config.defaultCity);
fs.mkdirSync(path.join(distDir, "en"), { recursive: true });
fs.writeFileSync(
  path.join(distDir, "en", "index.html"),
  legacyEnRedirectHtml(pagePath("en", config.defaultCity, config.defaultCity), rootLegacy),
);

finalizeDist();
console.log("default en: dist/index.html, ru: dist/ru/index.html, legacy /en/* → English paths");
