/** @typedef {'en' | 'ru'} Locale */

export const DEFAULT_LANG = "en";
export const LANG_COOKIE = "lang";

/**
 * @param {Locale} locale
 * @param {string} slug
 * @param {string} defaultCity
 */
export function pagePath(locale, slug, defaultCity) {
  const isDefault = slug === defaultCity;
  if (locale === "en") return isDefault ? "/" : `/${slug}/`;
  return isDefault ? "/ru/" : `/ru/${slug}/`;
}

/**
 * Former English URLs (redirect to pagePath('en', …)).
 * @param {string} slug
 * @param {string} defaultCity
 */
export function legacyEnPath(slug, defaultCity) {
  const isDefault = slug === defaultCity;
  return isDefault ? "/en/" : `/en/${slug}/`;
}

/**
 * @param {string} pathname
 * @param {Locale} pageLocale
 * @param {string} defaultCity
 */
export function slugFromPathname(pathname, pageLocale, defaultCity) {
  const norm = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (!norm || norm === "/") return defaultCity;
  const parts = norm.split("/").filter(Boolean);
  if (pageLocale === "ru") {
    if (parts[0] !== "ru") return defaultCity;
    return parts[1] || defaultCity;
  }
  if (parts[0] === "ru" || parts[0] === "en") return defaultCity;
  return parts[0];
}

/**
 * Inline redirect: honour `lang` cookie; `?setlang=` sets cookie without redirecting away.
 * @param {Locale} pageLocale
 * @param {string} defaultCity
 */
export function langRedirectScript(pageLocale, defaultCity) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `(function () {
  try {
    var PAGE_LOCALE = "${pageLocale}";
    var DEFAULT_CITY = "${esc(defaultCity)}";
    function pagePath(locale, slug) {
      var isDefault = slug === DEFAULT_CITY;
      if (locale === "en") return isDefault ? "/" : "/" + slug + "/";
      return isDefault ? "/ru/" : "/ru/" + slug + "/";
    }
    function slugFromPath() {
      var path = location.pathname.replace(/\\/$/, "") || "/";
      if (path === "/" || path === "") return DEFAULT_CITY;
      var parts = path.split("/").filter(Boolean);
      if (PAGE_LOCALE === "ru") {
        if (parts[0] !== "ru") return DEFAULT_CITY;
        return parts[1] || DEFAULT_CITY;
      }
      if (parts[0] === "ru" || parts[0] === "en") return DEFAULT_CITY;
      return parts[0];
    }
    function readCookie() {
      var m = document.cookie.match(/(?:^|; )${LANG_COOKIE}=(en|ru)(?:;|$)/);
      return m ? m[1] : null;
    }
    var params = new URLSearchParams(location.search);
    var setLang = params.get("setlang");
    if (setLang === "en" || setLang === "ru") {
      document.cookie = "${LANG_COOKIE}=" + setLang + ";path=/;max-age=31536000;SameSite=Lax"
        + (location.protocol === "https:" ? ";Secure" : "");
      params.delete("setlang");
      var q = params.toString();
      var next = location.pathname + (q ? "?" + q : "") + location.hash;
      if (next !== location.pathname + location.search + location.hash) {
        location.replace(next);
      }
      return;
    }
    var cookieLang = readCookie();
    if (!cookieLang || cookieLang === PAGE_LOCALE) return;
    var slug = slugFromPath();
    var target = pagePath(cookieLang, slug);
    var here = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/";
    var there = target.endsWith("/") ? target : target + "/";
    if (here.replace(/\\/+/g, "/") === there.replace(/\\/+/g, "/")) return;
    location.replace(target + location.search + location.hash);
  } catch (e) {}
})();`;
}

/**
 * @param {string} targetPath
 * @param {string} legacyPath
 */
export function legacyEnRedirectHtml(targetPath, legacyPath) {
  const t = targetPath.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${t}">
<link rel="canonical" href="${t}">
<title>Redirect</title>
<script>location.replace("${targetPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}");</script>
</head>
<body><p><a href="${t}">${t}</a></p></body>
</html>`;
}
