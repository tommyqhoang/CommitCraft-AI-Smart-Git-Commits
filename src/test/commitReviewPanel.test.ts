import { describe, expect, it } from "vitest";

import type { DiffContext } from "../git/diffCollector";
import { renderCommitAssistantHtml } from "../ui/commitAssistantHtml";

const baseDiffContext: DiffContext = {
  diff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  fullDiff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  diffSource: "unstaged" as const,
  files: ["src/a.ts", "src/b.ts"],
  excludedFiles: [{ path: ".env", reason: "secret-like file" }],
  fileStats: {
    "src/a.ts": { added: 10, removed: 3 },
    "src/b.ts": { added: 0, removed: 2 }
  },
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

  it("renders files to summarize as compact aligned rows", () => {
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

    expect(html).toContain('class="file-list"');
    expect(html).toContain('class="file-checkbox"');
    expect(html).toContain('aria-label="Include src/a.ts"');
    expect(html).toContain('class="file-open-btn"');
  });

  it("renders line stats as a compact stat strip with signed values", () => {
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

    expect(html).toContain('class="stat-strip"');
    expect(html).toContain('class="stat-item added"');
    expect(html).toContain("+12");
    expect(html).toContain('class="stat-item removed"');
    expect(html).toContain("-5");
  });

  it("uses a status rail and action bar in the generated view", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: {
          summary: "feat: improve commit assistant ui",
          description: "Adds clearer stat cards and action layout.",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('class="status-rail"');
    expect(html).toContain("CommitCraft Review");
    expect(html).toContain('class="action-bar"');
    expect(html).toContain('class="primary"');
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
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="summary"');
    expect(html).toContain('value="feat: split commit message fields"');
    expect(html).toContain('id="description"');
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
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Committed");
    expect(html).toContain("abc1234");
    expect(html).toContain('id="push"');
    expect(html).toContain('id="undoCommit"');
    expect(html).toContain("Undo Commit");
    expect(html).not.toContain('id="commit"');
  });

  it("renders enabled push actions with an active push style", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: {
          summary: "feat: make push visible",
          description: "Push should look available when enabled.",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="push" class="push-btn"');
    expect(html).not.toContain('id="push" class="secondary"');
  });

  it("renders commit and push activity history as a timeline", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        activityHistory: [
          {
            type: "commit",
            title: "Committed",
            detail: "feat: improve file list",
            hash: "abc1234"
          },
          {
            type: "push",
            title: "Pushed",
            detail: "main to origin",
            hash: "abc1234"
          }
        ],
        commitState: {
          status: "pushed",
          commitHash: "abc1234"
        },
        message: {
          summary: "feat: improve file list",
          description: "Makes the file list easier to scan.",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("History");
    expect(html).toContain('class="timeline"');
    expect(html).toContain('class="timeline-item commit"');
    expect(html).toContain('class="timeline-item push"');
    expect(html).toContain("feat: improve file list");
    expect(html).toContain("main to origin");
    expect(html).toContain("abc1234");
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
          riskLevel: "low"
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

    expect(html).toContain("Ready to Push");
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

  it("shows an undo button in the preview view when there are unpushed commits", () => {
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

    expect(html).toContain('id="undoCommit"');
    expect(html).toContain("Undo");
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
          riskLevel: "low"
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
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="commitAndPush"');
    expect(html).toContain("Commit + Push");
    expect(html).not.toContain('id="commitAndPush" disabled');
  });

  it("renders per-file added/removed line counts next to each file name", () => {
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

    expect(html).toContain("+10");
    expect(html).toContain("-3");
    expect(html).toContain("+0");
    expect(html).toContain("-2");
  });

  it("renders file names as clickable elements that dispatch openFile in the preview view", () => {
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

    expect(html).toContain("openFile");
    expect(html).toContain("src/a.ts");
  });

  it("renders file names as clickable in the generated (affected files) view", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: {
          summary: "feat: improve file list",
          description: "",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("openFile");
    expect(html).toContain("src/a.ts");
  });

  it("renders a warning when the AI response was recovered from non-JSON", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: true,
        recoveryReason: "unsupported commit type",
        canPush: true,
        message: {
          summary: "chore: update project",
          description: "",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('class="warnings"');
    expect(html).toContain("Recovered non-JSON response");
    expect(html).toContain("unsupported commit type");
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

  it("shows Pushed state with no push or undo buttons after a successful push", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        canReviewChanges: false,
        pendingPushCount: 0,
        commitState: {
          status: "pushed",
          commitHash: "abc1234"
        },
        message: {
          summary: "feat: ship the feature",
          description: "",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Pushed");
    expect(html).toContain("abc1234");
    expect(html).not.toContain('id="push"');
    expect(html).not.toContain('id="undoCommit"');
    expect(html).not.toContain('id="commit"');
  });

  it("shows Review Remaining Changes button after push when worktree still has changes", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        canReviewChanges: true,
        pendingPushCount: 0,
        commitState: {
          status: "pushed",
          commitHash: "abc1234"
        },
        message: {
          summary: "feat: partial commit",
          description: "",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Pushed");
    expect(html).toContain('id="reviewChanges"');
    expect(html).toContain("Review Remaining Changes");
    expect(html).not.toContain('id="push"');
    expect(html).not.toContain('id="undoCommit"');
  });

  it("disables push and commitAndPush in the generated view when canPush is false", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: false,
        pushDisabledReason: "Cannot push from a detached HEAD state.",
        message: {
          summary: "feat: some change",
          description: "",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="push"');
    expect(html).toContain("disabled");
    expect(html).toContain('id="commitAndPush"');
    expect(html).toContain("Cannot push from a detached HEAD state.");
  });

  it("disables push in post-commit view when canPush is false and shows reason", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: "openrouter/auto",
        diffContext: baseDiffContext,
        recovered: false,
        canPush: false,
        pushDisabledReason: "No Git remote is configured for this repository.",
        commitState: {
          status: "committed",
          commitHash: "abc1234"
        },
        message: {
          summary: "feat: local only commit",
          description: "",
          riskLevel: "low"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Committed");
    expect(html).toContain('id="push"');
    expect(html).toContain("disabled");
    expect(html).toContain("No Git remote is configured for this repository.");
  });

  it("disables push in pendingPush view when canPush is false", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: {
          ...baseDiffContext,
          diff: "",
          fullDiff: "",
          files: [],
          excludedFiles: [],
          stats: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 }
        },
        recovered: false,
        canPush: false,
        pushDisabledReason: "Cannot push from a detached HEAD state.",
        pendingPushCount: 1,
        commitState: {
          status: "pendingPush",
          commitHash: "abc1234"
        }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("Ready to Push");
    expect(html).toContain('id="push"');
    expect(html).toContain("disabled");
    expect(html).toContain("Cannot push from a detached HEAD state.");
  });

  it("does not show push banner in preview view when pendingPushCount is zero or absent", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: undefined,
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        pendingPushCount: 0,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).not.toContain("ready to push");
    expect(html).not.toContain('class="push-banner"');
  });

  it("disables push button in preview view when canPush is false with pending commits", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: undefined,
        diffContext: baseDiffContext,
        recovered: false,
        canPush: false,
        pushDisabledReason: "Cannot push from a detached HEAD state.",
        pendingPushCount: 2,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="push"');
    expect(html).toContain("disabled");
    expect(html).toContain("Cannot push from a detached HEAD state.");
    expect(html).toContain('id="generate"');
  });

  it("does not show the inline push button in preview view when there are no pending commits", () => {
    const html = renderCommitAssistantHtml(
      {
        modelUsed: undefined,
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        pendingPushCount: 0,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    // generate button present, but no push button in the preview action area
    expect(html).toContain('id="generate"');
    expect(html).not.toContain('id="push"');
  });

  it("error div is hidden by default and the message handler calls showError", () => {
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

    expect(html).toContain('id="error"');
    expect(html).toContain('style="display:none;"');
    expect(html).toContain("showError");
    expect(html).toContain('command === "error"');
  });

  // ── char counter ─────────────────────────────────────────────────────────

  it("renders a character counter next to the summary label in the generated view", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: { summary: "fix: something", description: "desc", riskLevel: "low" }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="summary-counter"');
    expect(html).toContain("/ 72");
    expect(html).toContain("14 / 72");
  });

  it("includes JS that toggles summary-over class when over 72 chars", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: { summary: "feat: new", description: "", riskLevel: "low" }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain("summary-counter");
    expect(html).toContain("summary-over");
    expect(html).toContain("updateSummaryCounter");
  });

  it("does not render a character counter in the preview view", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).not.toContain('id="summary-counter"');
  });

  // ── copy message button ───────────────────────────────────────────────────

  it("renders a copy button in the generated (edit) view", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: { summary: "fix: something", description: "desc", riskLevel: "low" }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="copyMessage"');
    expect(html).toContain("navigator.clipboard");
  });

  it("renders a copy button in the post-commit (committed) view when message is present", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: { summary: "fix: something", description: "desc", riskLevel: "low" },
        commitState: { status: "committed", commitHash: "abc1234" }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="copyMessage"');
  });

  it("renders a copy button in the post-commit (pushed) view when message is present", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        pendingPushCount: 0,
        message: { summary: "fix: something", description: "desc", riskLevel: "low" },
        commitState: { status: "pushed", commitHash: "abc1234" }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="copyMessage"');
  });

  // ── regenerate button ─────────────────────────────────────────────────────

  it("renders a regenerate button in the generated (edit) view", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: { summary: "fix: something", description: "desc", riskLevel: "low" }
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).toContain('id="regenerate"');
    expect(html).toContain("Regenerate");
  });

  it("does not render a regenerate button in the preview view", () => {
    const html = renderCommitAssistantHtml(
      {
        diffContext: baseDiffContext,
        recovered: false,
        canPush: true,
        message: undefined
      },
      { cspSource: "vscode-resource:", nonce: "test-nonce" }
    );

    expect(html).not.toContain('id="regenerate"');
  });
});
