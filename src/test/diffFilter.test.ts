import { describe, expect, it } from "vitest";

import { isSafeDiffFile, truncateDiff } from "../git/diffCollector";

describe("diff safety helpers", () => {
  it("rejects ignored secret, env, lock, and binary-like files", () => {
    expect(isSafeDiffFile("src/extension.ts")).toBe(true);
    expect(isSafeDiffFile(".env")).toBe(false);
    expect(isSafeDiffFile("secrets/openrouter-token.txt")).toBe(false);
    expect(isSafeDiffFile("assets/icon.png")).toBe(false);
    expect(isSafeDiffFile("package-lock.json")).toBe(false);
  });

  it("truncates diffs with an explicit marker", () => {
    const truncated = truncateDiff("abcdef", 3);

    expect(truncated.truncated).toBe(true);
    expect(truncated.diff).toContain("abc");
    expect(truncated.diff).toContain("[diff truncated");
  });
});
