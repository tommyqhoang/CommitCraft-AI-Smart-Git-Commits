import { describe, expect, it } from "vitest";

import type { DiffContext } from "../git/diffCollector";
import { renderCommitAssistantHtml } from "../ui/commitAssistantHtml";

const baseDiffContext: DiffContext = {
  diff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  diffSource: "unstaged" as const,
  files: ["src/a.ts", "src/b.ts"],
  excludedFiles: [{ path: ".env", reason: "secret-like file" }],
  stats: {
    filesChanged: 2,
    linesAdded: 1,
    linesRemoved: 0
  },
  truncated: false,
  warnings: []
};

describe("renderCommitAssistantHtml", () => {
  it("starts with a file preview and generate action before AI content exists", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: undefined,
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Review Changes");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("src/a.ts");
    expect(html).toContain(".env");
    expect(html).toContain("secret-like file");
    expect(html).toContain('id="generate"');
    expect(html).not.toContain('id="commit"');
  });

  it("shows Commit and Push whenever push is available", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: {
          summary: "feat: add assistant preview",
          description: "Adds a review step before generation.",
          riskLevel: "low",
          notableFiles: ["src/a.ts"]
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="commitAndPush"');
    expect(html).toContain("Commit and Push");
    expect(html).not.toContain('id="commitAndPush" disabled');
  });
});
