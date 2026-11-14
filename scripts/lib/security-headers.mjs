/** Shared security headers for static deploy targets (inline scripts require unsafe-inline). */

export const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self' https:; " +
  "font-src 'self' data:; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'none'; " +
  "object-src 'none'";

export const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

export function netlifyHeadersBlock() {
  const lines = ["/*"];
  for (const h of SECURITY_HEADERS) {
    lines.push(`  ${h.key}: ${h.value}`);
  }
  lines.push("", "/*.html", "  Cache-Control: no-cache, must-revalidate");
  lines.push("", "/**/*.html", "  Cache-Control: no-cache, must-revalidate");
  lines.push("", "/assets/*", "  Cache-Control: public, max-age=31536000, immutable");
  lines.push("", "/icon-*.png", "  Cache-Control: public, max-age=86400");
  lines.push("", "/favicon*", "  Cache-Control: public, max-age=86400");
  lines.push("", "/apple-touch-icon.png", "  Cache-Control: public, max-age=86400");
  lines.push("", "/sw.js", "  Cache-Control: no-cache, must-revalidate");
  lines.push("  Service-Worker-Allowed: /");
  return lines.join("\n") + "\n";
}
