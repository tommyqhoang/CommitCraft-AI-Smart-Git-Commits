import { describe, expect, it } from "vitest";

import { buildCommitPrompt } from "../openrouter/commitPrompt";

describe("buildCommitPrompt", () => {
  it("builds a deterministic prompt with stats, files, branch, and JSON instructions", () => {
    const prompt = buildCommitPrompt({
      repositoryName: "ai-commit-vscode-extension",
      branchName: "main",
      diff: "diff --git a/src/extension.ts b/src/extension.ts\n+activate();",
      diffSource: "staged",
      files: ["src/extension.ts"],
      languageHints: ["TypeScript"],
      stats: {
        filesChanged: 1,
        linesAdded: 1,
        linesRemoved: 0
      },
      truncated: false
    });

    expect(prompt).toContain("Repository: ai-commit-vscode-extension");
    expect(prompt).toContain("Branch: main");
    expect(prompt).toContain("Diff source: staged");
    expect(prompt).toContain("Files changed: 1");
    expect(prompt).toContain("src/extension.ts");
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain("Return only valid JSON");
  });
});
