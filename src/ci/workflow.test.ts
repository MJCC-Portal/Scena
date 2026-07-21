// Meta-tests for .github/workflows/ci.yml — catches a broken/regressed
// workflow file at PR time instead of discovering it only via a failed
// or missing GitHub Actions run. Deliberately does not attempt to
// simulate running the workflow (that's what GitHub Actions itself is
// for); it checks structure, required jobs, and the safety properties
// this repo's rules require (no secrets, no deploy, no migration).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

const WORKFLOW_PATH = path.resolve(__dirname, "../../.github/workflows/ci.yml");

function loadWorkflow(): any {
  const raw = readFileSync(WORKFLOW_PATH, "utf8");
  return load(raw);
}

const FORBIDDEN_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "MJCC_SSO_SECRET",
  "SUPABASE_ACCESS_TOKEN",
];

const FORBIDDEN_COMMAND_FRAGMENTS = [
  "deploy_edge_function",
  "supabase functions deploy",
  "supabase db push",
  "apply_migration",
  "supabase migration up",
];

describe("CI workflow file", () => {
  it("parses as valid YAML", () => {
    expect(() => loadWorkflow()).not.toThrow();
  });

  it("triggers on pull_request(main), push(main), and workflow_dispatch", () => {
    const workflow = loadWorkflow();
    // YAML's "on" key can be parsed as boolean `true` by some loaders —
    // js-yaml with the default schema keeps it as the string key "on".
    const triggers = workflow.on ?? workflow["true"];
    expect(triggers).toBeDefined();
    expect(triggers.pull_request?.branches).toContain("main");
    expect(triggers.push?.branches).toContain("main");
    expect(triggers).toHaveProperty("workflow_dispatch");
  });

  it("uses least-privilege top-level permissions", () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions).toEqual({ contents: "read" });
  });

  it("cancels stale runs via a workflow+ref concurrency group", () => {
    const workflow = loadWorkflow();
    expect(workflow.concurrency.group).toContain("github.workflow");
    expect(workflow.concurrency.group).toContain("github.ref");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
  });

  it("defines the three required jobs", () => {
    const workflow = loadWorkflow();
    expect(Object.keys(workflow.jobs)).toEqual(expect.arrayContaining(["application", "edge-functions", "contract-validation"]));
  });

  it("every job scopes permissions to contents: read", () => {
    const workflow = loadWorkflow();
    for (const [name, job] of Object.entries<any>(workflow.jobs)) {
      expect(job.permissions, `job "${name}" should set permissions`).toEqual({ contents: "read" });
    }
  });

  it("the application job runs the required commands via npm ci (never npm install)", () => {
    const workflow = loadWorkflow();
    const steps: string[] = workflow.jobs.application.steps.map((s: any) => s.run).filter(Boolean);
    const joined = steps.join("\n");
    expect(joined).toContain("npm ci");
    expect(joined).not.toMatch(/npm install(?!ed)/);
    expect(joined).toContain("npx tsc -b");
    expect(joined).toContain("npx vitest run");
    expect(joined).toContain("npm run build");
  });

  it("the edge-functions job runs deno check and does not invoke live Supabase functions", () => {
    const workflow = loadWorkflow();
    const steps: string[] = workflow.jobs["edge-functions"].steps.map((s: any) => s.run).filter(Boolean);
    const joined = steps.join("\n");
    expect(joined).toContain("deno check");
    expect(joined).not.toMatch(/curl .*supabase\.co\/functions/);
  });

  it("the contract-validation job validates the v2 JSON contracts", () => {
    const workflow = loadWorkflow();
    const steps: string[] = workflow.jobs["contract-validation"].steps.map((s: any) => s.run).filter(Boolean);
    expect(steps.join("\n")).toContain("validate-api-contracts.mjs");
  });

  it("references no forbidden production secret anywhere in the file", () => {
    const raw = readFileSync(WORKFLOW_PATH, "utf8");
    for (const secretName of FORBIDDEN_SECRETS) {
      expect(raw.includes(secretName), `workflow should not reference ${secretName}`).toBe(false);
    }
    // No `secrets.` context usage anywhere — this workflow needs none.
    expect(raw).not.toMatch(/secrets\./);
  });

  it("does not deploy the application or Edge Functions, and does not apply migrations", () => {
    // Scans only executable `run:` step bodies (not the file's own
    // explanatory comments, which legitimately name these fragments to
    // say what must never appear below them).
    const workflow = loadWorkflow();
    const allRunSteps = Object.values<any>(workflow.jobs)
      .flatMap((job) => job.steps.map((step: any) => step.run).filter(Boolean))
      .join("\n");
    for (const fragment of FORBIDDEN_COMMAND_FRAGMENTS) {
      expect(allRunSteps.includes(fragment), `a run step should not contain "${fragment}"`).toBe(false);
    }
  });

  it("does not run on a self-hosted runner", () => {
    const workflow = loadWorkflow();
    for (const [name, job] of Object.entries<any>(workflow.jobs)) {
      expect(job["runs-on"], `job "${name}"`).toBe("ubuntu-latest");
    }
  });
});
