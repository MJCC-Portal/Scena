#!/usr/bin/env node
// API contract validation for tracked v1, planned v2, and live UI contracts.
// No network access or production credential is used.

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
    else console.log(`SKIP: ${relativePath} does not exist.`);
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(fullPath, "utf8"));
    console.log(`OK: ${relativePath} parses as JSON.`);
    return parsed;
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function requireFields(label, value, fields) {
  if (!value) return;
  for (const field of fields) {
    const result = field
      .split(".")
      .reduce((current, part) => current?.[part], value);
    if (result === undefined) {
      fail(`${label} is missing required field "${field}".`);
    }
  }
}

const contracts = [
  {
    path: "docs/openapi.json",
    required: false,
    fields: ["openapi", "info.title", "info.version", "paths"],
  },
  {
    path: "docs/api/v2/openapi.json",
    required: true,
    fields: ["openapi", "info.title", "info.version", "paths"],
  },
  {
    path: "docs/api/v2/media-and-boards.openapi.json",
    required: true,
    fields: [
      "openapi",
      "info.title",
      "info.version",
      "x-verification.status",
      "paths",
    ],
  },
  {
    path: "docs/api/v2/ui-integration.openapi.json",
    required: true,
    fields: [
      "openapi",
      "info.title",
      "info.version",
      "x-verification.status",
      "x-verification.publication_available",
      "paths./workspace-context",
      "paths./asset-upload",
      "paths./board-interaction",
    ],
  },
];

const parsedContracts = contracts.map((contract) => {
  const value = readJson(contract.path, { required: contract.required });
  requireFields(contract.path, value, contract.fields);
  return { ...contract, value };
});

const v1Inventory = readJson("docs/api-inventory.json", { required: false });
const v2Inventory = readJson("docs/api/v2/api-inventory.json", {
  required: true,
});

requireFields("docs/api/v2/api-inventory.json", v2Inventory, [
  "generated",
  "note",
  "paths",
  "sharedInfrastructure",
]);

const plannedV2 = parsedContracts.find(
  (contract) => contract.path === "docs/api/v2/openapi.json",
)?.value;

if (plannedV2 && plannedV2.info?.version !== "2") {
  fail(
    `docs/api/v2/openapi.json info.version must be exactly "2", got ${JSON.stringify(
      plannedV2.info?.version,
    )}.`,
  );
}

const uiContract = parsedContracts.find(
  (contract) =>
    contract.path === "docs/api/v2/ui-integration.openapi.json",
)?.value;

if (uiContract?.["x-verification"]?.publication_available !== false) {
  fail(
    "The UI contract must keep publication_available=false until a manager publication endpoint is deployed and accepted.",
  );
}

function collectOperationIds(document, source) {
  const ids = [];
  if (!document?.paths) return ids;

  for (const [routePath, methods] of Object.entries(document.paths)) {
    if (typeof methods !== "object" || methods === null) continue;

    for (const [method, operation] of Object.entries(methods)) {
      const operationId = operation?.operationId;
      if (typeof operationId === "string" && operationId) {
        ids.push({ operationId, source, path: routePath, method });
      }
    }
  }

  return ids;
}

const allOperationIds = parsedContracts.flatMap((contract) =>
  collectOperationIds(contract.value, contract.path),
);

const seen = new Map();
for (const entry of allOperationIds) {
  const existing = seen.get(entry.operationId);
  if (existing) {
    fail(
      `Duplicate operationId "${entry.operationId}": ${existing.source} ${existing.method.toUpperCase()} ${existing.path} vs. ${entry.source} ${entry.method.toUpperCase()} ${entry.path}.`,
    );
  } else {
    seen.set(entry.operationId, entry);
  }
}

if (allOperationIds.length === 0) {
  console.log("OK: no operationId fields defined yet.");
} else {
  console.log(`OK: ${allOperationIds.length} operationId(s) are unique.`);
}

const generatorCandidates = [
  "scripts/generate-api-contracts.mjs",
  "scripts/generate-api-contracts.js",
];
const generator = generatorCandidates.find((candidate) =>
  existsSync(path.join(repoRoot, candidate)),
);

if (!generator) {
  console.log(
    "SKIP: no deterministic contract-generation command exists; tracked contracts are validated structurally.",
  );
} else {
  fail(
    `A generator (${generator}) exists but this validator does not compare its output.`,
  );
}

void v1Inventory;

if (failures > 0) {
  console.error(`\n${failures} contract validation failure(s).`);
  process.exit(1);
}

console.log("\nAll API contract checks passed.");
