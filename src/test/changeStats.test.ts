import { describe, expect, it } from "vitest";

import { calculateChangeStats } from "../git/changeStats";

describe("calculateChangeStats", () => {
  it("counts changed files, added lines, and removed lines from a unified diff", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 111..222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,3 @@",
      " const kept = true;",
      "-const oldValue = 1;",
      "+const newValue = 2;",
      "+const anotherValue = 3;",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- a/src/b.ts",
      "+++ b/src/b.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new"
    ].join("\n");

    expect(calculateChangeStats(diff)).toEqual({
      filesChanged: 2,
      linesAdded: 3,
      linesRemoved: 2
    });
  });
});
