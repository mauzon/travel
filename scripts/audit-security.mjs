#!/usr/bin/env node
/**
 * Security and privacy audit for the travel template repo (and optional live URL).
 * Usage: npm run audit:security [-- --url https://your-site.example]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectHttpViolations } from "./lib/https-urls.mjs";
import { CSP, SECURITY_HEADERS } from "./lib/security-headers.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const deployUrl = (() => {
  const i = argv.indexOf("--url");
  return i >= 0 ? argv[i + 1] : process.env.AUDIT_DEPLOY_URL || "";
})();

const date = new Date().toISOString().slice(0, 10);
const reportDir = path.join(root, "reports");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `security-audit-${date}.md`);

const findings = [];
const passes = [];

function pass(id, detail) {
  passes.push({ id, detail });
}
function fail(id, detail, fix) {
  findings.push({ id, severity: "fail", detail, fix });
}
function warn(id, detail, fix) {
  findings.push({ id, severity: "warn", detail, fix });
}

function readGitignore() {
  const p = path.join(root, ".gitignore");
  if (!fs.existsSync(p)) return new Set();
  return new Set(
    fs
      .readFileSync(p, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")),
  );
}

function trackedFiles() {
  const r = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) return [];
  return r.stdout.split("\n").filter(Boolean);
}

const SECRET_PATTERNS = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub PAT", re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "OpenAI-style key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "Bearer token", re: /Bearer\s+[A-Za-z0-9._-]{20,}/i },
  { name: "Generic API key assignment", re: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\s]{8,}['"]/i },
];

const PERSONAL_PATTERNS = [
  { name: "Email", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: "Phone (international)", re: /\+?\d[\d\s().-]{8,}\d/ },
];

const ALLOWED_EMAIL_PATHS = [/^demo\//, /^docs\//, /^AGENTS\.md$/, /^README\.md$/];

function scanContentSecrets(label, content) {
  const hits = [];
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(content)) hits.push(name);
  }
  return hits.length ? { label, hits } : null;
}

function isAllowedPersonalContext(filePath) {
  return ALLOWED_EMAIL_PATHS.some((re) => re.test(filePath));
}

// —— npm audit ——
const auditRun = spawnSync("npm", ["audit", "--json"], { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
let npmAuditSummary = "npm audit could not run";
if (auditRun.status === 0 || auditRun.stdout) {
  try {
    const j = JSON.parse(auditRun.stdout || "{}");
    const meta = j.metadata?.vulnerabilities || {};
    const total = Object.values(meta).reduce((a, n) => a + (typeof n === "number" ? n : 0), 0);
    npmAuditSummary = `vulnerabilities: ${JSON.stringify(meta)} (total count fields: ${total})`;
    if (total > 0) {
      warn("npm-audit", npmAuditSummary, "Run `npm audit` and apply `npm audit fix` or upgrade dependencies.");
    } else pass("npm-audit", npmAuditSummary);
  } catch {
    warn("npm-audit", "Could not parse npm audit JSON", "Run `npm audit` manually.");
  }
} else {
  warn("npm-audit", auditRun.stderr?.slice(0, 200) || "failed", "Ensure `npm ci` completed.");
}

// —— gitleaks / trufflehog ——
const gitRoot = path.join(root, ".git");
const leaks = [];
if (fs.existsSync(gitRoot)) {
  const gl = spawnSync("gitleaks", ["detect", "--no-banner", "--source", root, "-f", "json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (gl.status === 0 || gl.status === 1) {
    pass("gitleaks", gl.status === 0 ? "no leaks reported" : "gitleaks finished (see report if findings)");
    if (gl.stdout && gl.stdout.includes("Finding")) {
      warn("gitleaks", "gitleaks reported findings", "Review gitleaks output and rotate any exposed secrets.");
    }
  } else {
    const th = spawnSync("trufflehog", ["filesystem", root, "--json"], { cwd: root, encoding: "utf8" });
    if (th.status === 0 && !th.stdout?.trim()) {
      pass("trufflehog", "no findings");
    } else if (th.status === 0 && th.stdout?.trim()) {
      warn("trufflehog", "possible secrets in filesystem scan", "Review trufflehog JSON output.");
    } else {
      const files = trackedFiles();
      const secretHits = [];
      for (const f of files) {
        if (f.startsWith("reports/")) continue;
        const full = path.join(root, f);
        if (!fs.existsSync(full) || fs.statSync(full).size > 2_000_000) continue;
        let text;
        try {
          text = fs.readFileSync(full, "utf8");
        } catch {
          continue;
        }
        const h = scanContentSecrets(f, text);
        if (h) secretHits.push(h);
      }
      if (secretHits.length) {
        warn(
          "regex-secrets",
          `Pattern matches in ${secretHits.length} tracked file(s): ${secretHits
            .slice(0, 5)
            .map((x) => x.label)
            .join(", ")}`,
          "Remove or move secrets to env; use host secret stores.",
        );
      } else pass("regex-secrets", "No high-risk secret patterns in tracked files");
    }
  }
}

// —— .gitignore ——
const ig = readGitignore();
for (const must of [".travel/instance.json", ".env", "reports/"]) {
  const ok =
    ig.has(must) ||
    ig.has(must.replace(/\/$/, "")) ||
    [...ig].some((line) => must.startsWith(line.replace(/\/$/, "") + "/"));
  if (ok) pass("gitignore-" + must, "listed in .gitignore");
  else fail("gitignore-" + must, `Missing from .gitignore: ${must}`, `Add \`${must}\` to .gitignore.`);
}

// —— https URL scheme in city data ——
const citiesDir = path.join(root, "data/cities");
if (fs.existsSync(citiesDir)) {
  const cityFiles = fs.readdirSync(citiesDir).filter((f) => f.endsWith(".json"));
  const httpBad = [];
  for (const f of cityFiles) {
    const city = JSON.parse(fs.readFileSync(path.join(citiesDir, f), "utf8"));
    httpBad.push(...collectHttpViolations(city, f));
  }
  if (httpBad.length) {
    fail(
      "https-urls",
      `${httpBad.length} non-https URL(s) in city data`,
      "Use only `https://` in maps_url, google_maps_url, sources, and source_urls.",
    );
  } else if (cityFiles.length) pass("https-urls", `${cityFiles.length} city file(s) — all external URLs https`);
  else pass("https-urls", "no city files (empty template)");
}

// —— personal data outside data/ ——
const personalOutside = [];
for (const f of trackedFiles()) {
  if (f.startsWith("data/")) continue;
  if (isAllowedPersonalContext(f)) continue;
  const full = path.join(root, f);
  if (!fs.existsSync(full)) continue;
  let text;
  try {
    text = fs.readFileSync(full, "utf8");
  } catch {
    continue;
  }
  if (PERSONAL_PATTERNS[0].re.test(text)) {
    const emails = text.match(PERSONAL_PATTERNS[0].re) || [];
    const suspicious = emails.filter((e) => !/@(example\.com|users\.noreply\.github\.com)/i.test(e));
    if (suspicious.length) personalOutside.push({ file: f, sample: suspicious[0] });
  }
}
if (personalOutside.length) {
  warn(
    "personal-data",
    `Possible emails in non-data paths: ${personalOutside.map((p) => p.file).join(", ")}`,
    "Redact personal emails; keep only fictional addresses in demos/docs.",
  );
} else pass("personal-data", "No unexpected emails in tracked non-data files");

// —— repo security header config ——
const vercel = path.join(root, "vercel.json");
if (fs.existsSync(vercel)) {
  const v = JSON.parse(fs.readFileSync(vercel, "utf8"));
  if (v.headers?.length) pass("vercel-headers", "vercel.json defines headers");
  else warn("vercel-headers", "vercel.json has no headers block", "Add Content-Security-Policy and related headers.");
}
const serveJson = path.join(root, "serve.json");
if (fs.existsSync(serveJson)) pass("serve-headers", "serve.json present for Railway/local");
else warn("serve-headers", "serve.json missing", "Add serve.json so `npm start` sends security headers.");
const ci = path.join(root, ".github/workflows/ci.yml");
if (fs.existsSync(ci)) {
  const text = fs.readFileSync(ci, "utf8");
  if (/@v\d+/.test(text) && !/uses: actions\/\w+@[0-9a-f]{40}/i.test(text)) {
    warn("actions-pin", "GitHub Actions use floating @v tags", "Pin actions to full commit SHAs.");
  } else pass("actions-pin", "CI workflow uses pinned SHAs or no actions");
}

// —— deployed site ——
async function probeDeploy(url) {
  if (!url) {
    pass("deploy-probe", "skipped (pass `--url https://…` or AUDIT_DEPLOY_URL)");
    return;
  }
  try {
    const res = await fetch(url, { redirect: "manual" });
    const code = res.status;
  if ([301, 302, 303, 307, 308, 401, 403].includes(code)) {
    pass("deploy-auth", `HTTP ${code} for anonymous request (access control likely active)`);
  } else if (code === 200) {
    warn(
      "deploy-auth",
      `HTTP 200 for anonymous GET — site may be fully public`,
      "If the site should be private, enable host access protection (e.g. Cloudflare Access).",
    );
  } else {
    warn("deploy-auth", `Unexpected status ${code}`, "Confirm the URL and deployment health.");
  }
    const h = (name) => res.headers.get(name);
    if (h("content-security-policy")) pass("deploy-csp", "CSP header present");
    else warn("deploy-csp", "No Content-Security-Policy on live response", "Ensure host serves dist/_headers or platform headers.");
    if (url.startsWith("https://")) {
      if (h("strict-transport-security")) pass("deploy-hsts", "HSTS present");
      else warn("deploy-hsts", "No Strict-Transport-Security", "Enable HTTPS and HSTS on the host.");
    }
    for (const { key } of SECURITY_HEADERS) {
      if (key === "Content-Security-Policy" || key === "Strict-Transport-Security") continue;
      if (h(key.toLowerCase())) continue;
    }
  } catch (e) {
    warn("deploy-probe", `Could not fetch ${url}: ${e.message}`, "Check DNS, TLS, and network from CI/agent.");
  }
}

await probeDeploy(deployUrl);

// —— report ——
const lines = [
  `# Security audit — ${date}`,
  "",
  "Generated by `npm run audit:security`. This file is gitignored.",
  "",
  "## Summary",
  "",
  `- **Passes:** ${passes.length}`,
  `- **Findings:** ${findings.filter((f) => f.severity === "fail").length} fail, ${findings.filter((f) => f.severity === "warn").length} warn`,
  deployUrl ? `- **Deploy URL:** ${deployUrl}` : "- **Deploy URL:** (not checked)",
  "",
  "## What each check means",
  "",
  "| Check | Meaning |",
  "|-------|---------|",
  "| npm-audit | Known vulnerable npm dependencies |",
  "| gitleaks / trufflehog / regex-secrets | Credentials or API keys in the repo |",
  "| gitignore-* | Local secrets and instance state stay out of git |",
  "| https-urls | External map/source links must not use `http:` |",
  "| personal-data | Real emails/phones outside your trip data folder |",
  "| vercel-headers / serve-headers | Static host sends CSP and hardening headers |",
  "| actions-pin | CI uses immutable action versions |",
  "| deploy-* | Live site headers and access control (optional URL) |",
  "",
  "## Passes",
  "",
  ...passes.map((p) => `- **${p.id}:** ${p.detail}`),
  "",
  "## Findings",
  "",
];

if (!findings.length) lines.push("_No findings._");
else {
  for (const f of findings) {
    lines.push(`### ${f.severity.toUpperCase()}: ${f.id}`, "", f.detail, "", `**Fix:** ${f.fix}`, "");
  }
}

lines.push("## Reference CSP (build)", "", "```", CSP, "```", "");

fs.writeFileSync(reportPath, lines.join("\n"));
console.log(`Wrote ${reportPath}`);
console.log(`Passes: ${passes.length}, findings: ${findings.length}`);
process.exit(findings.some((f) => f.severity === "fail") ? 1 : 0);
