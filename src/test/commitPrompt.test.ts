import { describe, expect, it } from "vitest";

import { buildCommitPrompt } from "../openrouter/commitPrompt";

describe("buildCommitPrompt", () => {
  it("builds a deterministic prompt with stats, files, branch, and JSON instructions", () => {
    const prompt = buildCommitPrompt({
      repositoryName: "CommitCraft-AI-Smart-Git-Commits",
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

    expect(prompt).toContain("Repository: CommitCraft-AI-Smart-Git-Commits");
    expect(prompt).toContain("Branch: main");
    expect(prompt).toContain("Diff source: staged");
    expect(prompt).toContain("Files changed: 1");
    expect(prompt).toContain("src/extension.ts");
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain("Return only valid JSON");
    expect(prompt).toContain("style, perf, revert");
  });

  it("renders fallback text for empty file and language lists", () => {
    const prompt = buildCommitPrompt({
      repositoryName: "repo",
      branchName: "detached HEAD",
      diff: "",
      diffSource: "unstaged",
      files: [],
      languageHints: [],
      stats: {
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0
      },
      truncated: true
    });

    expect(prompt).toContain("Languages: No cheap language hints");
    expect(prompt).toContain("Diff truncated: yes");
    expect(prompt).toContain("Changed files:\n- none");
  });
});
