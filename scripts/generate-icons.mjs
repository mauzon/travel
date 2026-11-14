#!/usr/bin/env node
/**
 * Generate suitcase (🧳 U+1F9F3) favicons from Twemoji into public/.
 * Requires: pip install pillow
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const py = spawnSync(
  "python3",
  [
    "-c",
    `import runpy; runpy.run_path("${path.join(root, "scripts/generate-icons.py")}")`,
  ],
  { stdio: "inherit", cwd: root },
);
process.exit(py.status ?? 1);