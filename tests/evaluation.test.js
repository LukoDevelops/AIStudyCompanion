import { describe, expect, it } from "vitest";
import { runEvaluationFixtures } from "../src/evaluation/runFixtures.js";

describe("evaluation fixtures", () => {
  it("passes the built-in local-engine cases", async () => {
    const rows = await runEvaluationFixtures("local");
    const failed = rows.filter((row) => !row.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  });

  it("passes the same cases on the original baseline", async () => {
    const rows = await runEvaluationFixtures("baseline");
    const failed = rows.filter((row) => !row.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  });
});
