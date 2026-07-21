#!/usr/bin/env node
// API contract validation — run in CI (contract-validation job) and
// locally (`node scripts/validate-api-contracts.mjs`) with identical
// behavior. No network access, no dependencies beyond Node built-ins, so
// this job never needs `npm ci` or any credential.
//
// Checks:
//   1. Every listed file parses as JSON.
//   2. Required top-level fields exist on the v2 contract files.
//   3. No duplicate OpenAPI operationId across any openapi.json found.
//   4. API version metadata is present and correct where it's meaningful.
//   5. Generated-file staleness — skipped with an explicit message when no
//      deterministic generation command exists in this repo (none does,
//      today; these docs are hand-maintained). Not a silent pass.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");
let failures = 0;

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function readJson(relativePath, { required }) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!existsSync(fullPath)) {
    if (required) fail(`${relativePath} is required but does not exist.`);
    else console.log(`SKIP: ${relativePath} does not exist (not required — v1 doc may be retired later).`);
    return null;
  }
  const raw = readFileSync(fullPath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    console.log(`OK: ${relativePath} parses as JSON.`);
    return parsed;
  } catch (err) {
    fail(`${relativePath} is not valid JSON: ${err.message}`);
    return null;
  }
}

function requireFields(label, obj, fields) {
  if (!obj) return;
  for (const field of fields) {
    const parts = field.split(".");
    let value = obj;
    for (const part of parts) value = value?.[part];
    if (value === undefined) fail(`${label} is missing required field "${field}".`);
  }
}

// 1 + 2. Parse and structurally validate each contract file.
const v1Openapi = readJson("docs/openapi.json", { required: false });
const v1Inventory = readJson("docs/api-inventory.json", { required: false });
const v2Openapi = readJson("docs/api/v2/openapi.json", { required: true });
const v2Inventory = readJson("docs/api/v2/api-inventory.json", { required: true });

requireFields("docs/api/v2/openapi.json", v2Openapi, ["openapi", "info.title", "info.version", "paths"]);
requireFields("docs/api/v2/api-inventory.json", v2Inventory, ["generated", "note", "paths", "sharedInfrastructure"]);

// 4. API version metadata.
if (v2Openapi && v2Openapi.info?.version !== "2") {
  fail(`docs/api/v2/openapi.json info.version must be exactly "2", got ${JSON.stringify(v2Openapi.info?.version)}.`);
} else if (v2Openapi) {
  console.log("OK: docs/api/v2/openapi.json info.version is \"2\".");
}
if (v1Openapi && typeof v1Openapi.info?.version !== "string") {
  fail("docs/openapi.json info.version must be a non-empty string.");
}

// 3. Duplicate operationId detection across every openapi.json found.
function collectOperationIds(doc, sourceLabel) {
  const ids = [];
  if (!doc?.paths) return ids;
  for (const [routePath, methods] of Object.entries(doc.paths)) {
    if (typeof methods !== "object" || methods === null) continue;
    for (const [method, operation] of Object.entries(methods)) {
      const operationId = operation?.operationId;
      if (typeof operationId === "string" && operationId.length > 0) {
        ids.push({ operationId, source: sourceLabel, path: routePath, method });
      }
    }
  }
  return ids;
}

const allOperationIds = [
  ...collectOperationIds(v1Openapi, "docs/openapi.json"),
  ...collectOperationIds(v2Openapi, "docs/api/v2/openapi.json"),
];
const seen = new Map();
for (const entry of allOperationIds) {
  const existing = seen.get(entry.operationId);
  if (existing) {
    fail(`Duplicate operationId "${entry.operationId}": ${existing.source} ${existing.method.toUpperCase()} ${existing.path} vs. ${entry.source} ${entry.method.toUpperCase()} ${entry.path}.`);
  } else {
    seen.set(entry.operationId, entry);
  }
}
if (allOperationIds.length === 0) {
  console.log("OK: no operationId fields defined anywhere yet (nothing to deduplicate).");
} else if (failures === 0) {
  console.log(`OK: ${allOperationIds.length} operationId(s) found, no duplicates.`);
}

// 5. Staleness — only meaningful once a generation command exists.
const generatorCandidates = ["scripts/generate-api-contracts.mjs", "scripts/generate-api-contracts.js"];
const generator = generatorCandidates.find((candidate) => existsSync(path.join(repoRoot, candidate)));
if (!generator) {
  console.log("SKIP: no deterministic contract-generation command exists in this repo yet — staleness check has nothing to compare against.");
} else {
  fail(`A generator (${generator}) exists but this script does not yet know how to diff its output — update validate-api-contracts.mjs before relying on this check.`);
}

if (failures > 0) {
  console.error(`\n${failures} contract validation failure(s).`);
  process.exit(1);
}
console.log("\nAll API contract checks passed.");
