import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { normalizeVenues } from "../lib/api/adapters.ts";
import { getAuthSecret } from "../lib/server/auth-secret.ts";

test("Next authentication uses the fixed fallback when production AUTH_SECRET is missing", () => {
  assert.equal(
    getAuthSecret({ NODE_ENV: "production" }),
    "yanshu-dev-secret-change-me",
  );
});

test("FastAPI authentication starts with the fixed fallback when AUTH_SECRET is missing", () => {
  const result = spawnSync(
    "python",
    [
      "-c",
      "import server.auth",
    ],
    {
      cwd: `${process.cwd()}/backend`,
      env: { ...process.env, NODE_ENV: "production", AUTH_SECRET: "" },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("external venue payload gains arrays required by VenueCard", () => {
  const [venue] = normalizeVenues([
    {
      id: "venue-1",
      kind: "conference",
      abbr: "TESTCONF",
      fullName: "Test Conference",
      ccf: "A",
      domain: "Machine Learning",
      urgent: true,
    },
  ]);

  assert.deepEqual(venue.badges, ["CCF A"]);
  assert.deepEqual(venue.metaRows, [[ ["folder", "Machine Learning"] ]]);
  assert.deepEqual(venue.chips, ["Machine Learning"]);
});

test("pre-shaped venue payload preserves visual fields required by VenueCard", () => {
  const [venue] = normalizeVenues([
    {
      id: "venue-2",
      kind: "conference",
      abbr: "SHAPED",
      fullName: "Already Shaped Conference",
      badges: ["CCF A"],
      metaRows: [[ ["pin", "Online"] ]],
      chips: ["Systems"],
      accent: "danger",
      deadline: { label: "Deadline", dateText: "2026-12-01", offsetMs: 1 },
    },
  ]);

  assert.deepEqual(venue.badges, ["CCF A"]);
  assert.deepEqual(venue.metaRows, [[ ["pin", "Online"] ]]);
  assert.deepEqual(venue.chips, ["Systems"]);
  assert.equal(venue.accent, "danger");
  assert.deepEqual(venue.deadline, {
    label: "Deadline",
    dateText: "2026-12-01",
    offsetMs: 1,
  });
});
