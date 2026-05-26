#!/usr/bin/env node
/**
 * Generate TypeScript types from the running backend's OpenAPI schema.
 *
 * Run from `frontend/`:
 *
 *   npm run gen:api               # uses BACKEND_URL or defaults to http://localhost:8000
 *   BACKEND_URL=https://api.staging.hms.in npm run gen:api
 *
 * Requires the backend to be running. Output goes to src/lib/api/schema.ts.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BACKEND_URL  = process.env.BACKEND_URL || "http://localhost:8000";
const SCHEMA_URL   = `${BACKEND_URL}/api/schema/?format=json`;
const OUT_PATH     = path.resolve(__dirname, "../src/lib/api/schema.ts");

console.log(`→ Fetching schema from ${SCHEMA_URL}`);

try {
  // openapi-typescript can read directly from a URL or a local file.
  // We pass the URL straight through so the backend stays the source of truth.
  execSync(
    `npx --yes openapi-typescript@7 "${SCHEMA_URL}" --output "${OUT_PATH}"`,
    { stdio: "inherit" },
  );
  const size = fs.statSync(OUT_PATH).size;
  console.log(`✓ Generated ${OUT_PATH} (${(size / 1024).toFixed(1)} KB)`);
  console.log(`  → use it via:  import type { paths, components } from "@/lib/api/schema";`);
} catch (e) {
  console.error("✗ Codegen failed.");
  console.error("  Make sure the backend is running and that GET /api/schema/ returns the schema.");
  process.exit(1);
}
