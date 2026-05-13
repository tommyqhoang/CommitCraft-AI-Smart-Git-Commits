import { describe, expect, it } from "vitest";

import type { DiffContext } from "../git/diffCollector";
import { renderCommitAssistantHtml } from "../ui/commitAssistantHtml";

const baseDiffContext: DiffContext = {
  diff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  fullDiff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  diffSource: "unstaged" as const,
  files: ["src/a.ts", "src/b.ts"],
  excludedFiles: [{ path: ".env", reason: "secret-like file" }],
  stats: {
    filesChanged: 2,
    linesAdded: 1,
    linesRemoved: 0
  },
  truncated: false,
  warnings: [],
  maxDiffCharacters: 60_000
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

  it("renders line stats as signed visual stat cards", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: undefined,
        diffContext: {
          ...baseDiffContext,
          stats: {
            filesChanged: 3,
            linesAdded: 12,
            linesRemoved: 5
          }
        },
        recovered: false,
        canPush: true,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('class="stat-card stat-added"');
    expect(html).toContain("+12");
    expect(html).toContain('class="stat-card stat-removed"');
    expect(html).toContain("-5");
    expect(html).toContain('class="stat-card stat-files"');
  });

  it("uses a clearer assistant shell with title, subtitle, and primary actions", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: {
          summary: "feat: improve commit assistant ui",
          description: "Adds clearer stat cards and action layout.",
          riskLevel: "low",
          notableFiles: ["src/a.ts"]
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('class="assistant-shell"');
    expect(html).toContain("Review the generated message");
    expect(html).toContain('class="actions action-bar"');
    expect(html).toContain('class="primary-action"');
  });

  it("renders generated summary and description as separate editable fields", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: {
          summary: "feat: split commit message fields",
          description: "Shows the summary separately from a longer scrollable description.",
          riskLevel: "low",
          notableFiles: ["src/a.ts"]
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="summary"');
    expect(html).toContain('value="feat: split commit message fields"');
    expect(html).toContain('id="description"');
    expect(html).toContain('class="description-box"');
    expect(html).toContain("Shows the summary separately");
    expect(html).toContain("function commitMessageValue()");
    expect(html).toContain("message: commitMessageValue()");
  });

  it("shows a committed state with push and undo actions after commit succeeds", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        commitState: {
          status: "committed",
          commitHash: "abc1234"
        },
        message: {
          summary: "feat: add post commit state",
          description: "Shows push and undo actions after commit.",
          riskLevel: "low",
          notableFiles: ["src/a.ts"]
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Commit successful");
    expect(html).toContain("abc1234");
    expect(html).toContain('id="push"');
    expect(html).toContain('id="undoCommit"');
    expect(html).toContain("Undo Commit");
    expect(html).not.toContain('id="commit"');
  });

  it("posts undo commit actions from the committed state", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        commitState: {
          status: "committed",
          commitHash: "abc1234"
        },
        message: {
          summary: "feat: add post commit state",
          description: "Shows push and undo actions after commit.",
          riskLevel: "low",
          notableFiles: ["src/a.ts"]
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="undoCommit"');
    expect(html).toContain('command: "undoCommit"');
  });

  it("shows a pending push state when commits exist without current file changes", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: {
          ...baseDiffContext,
          diff: "",
          fullDiff: "",
          files: [],
          excludedFiles: [],
          stats: {
            filesChanged: 0,
            linesAdded: 0,
            linesRemoved: 0
          }
        },
        recovered: false,
        canPush: true,
        pendingPushCount: 2,
        commitState: {
          status: "pendingPush",
          commitHash: "def5678"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Ready to push");
    expect(html).toContain("2 unpushed commits");
    expect(html).toContain('id="push"');
    expect(html).toContain("Undo Last Commit");
    expect(html).not.toContain('id="generate"');
  });

  it("lets users push pending commits while reviewing additional file changes", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: undefined,
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        pendingPushCount: 1,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("1 unpushed commit");
    expect(html).toContain('id="push"');
    expect(html).toContain('id="generate"');
    expect(html).toContain("Generate Message");
  });

  it("offers to review remaining changes after a local commit leaves more worktree changes", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        canReviewChanges: true,
        pendingPushCount: 1,
        commitState: {
          status: "committed",
          commitHash: "abc1234"
        },
        message: {
          summary: "feat: commit selected files",
          description: "Leaves other files available for another commit.",
          riskLevel: "low",
          notableFiles: ["src/a.ts"]
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Review Remaining Changes");
    expect(html).toContain('id="reviewChanges"');
    expect(html).toContain('command: "reviewChanges"');
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

  it("does not offer generation when no safe files are available", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: {
          ...baseDiffContext,
          diff: "",
          fullDiff: "",
          files: [],
          excludedFiles: [{ path: ".env", reason: "secret-like file" }],
          stats: {
            filesChanged: 0,
            linesAdded: 0,
            linesRemoved: 0
          }
        },
        recovered: false,
        canPush: false,
        pushDisabledReason: "No Git remote is configured for this repository."
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("No safe text files are available to summarize.");
    expect(html).toContain(".env");
    expect(html).not.toContain('id="generate"');
  });
});
