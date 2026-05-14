import { describe, expect, it, vi, beforeEach } from "vitest";

// vscode resolves to src/test/mocks/vscode.ts via vitest alias
import * as vscode from "vscode";

import { generateCommitMessage } from "../commands/generateCommitMessage";
import type { CommitReviewHandlers, CommitReviewData } from "../ui/commitReviewPanel";
import { GitService } from "../git/gitService";
import { OpenRouterClient } from "../openrouter/openRouterClient";
import { GitOperationError, NetworkError, UserInputError } from "../errors";
import type { DiffContext } from "../git/diffCollector";

// ─── module mocks ────────────────────────────────────────────────────────────

vi.mock("../ui/commitReviewPanel", () => ({
  showCommitReviewPanel: vi.fn(() => ({
    dispose: vi.fn(),
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() }))
  }))
}));

// Sync factory — avoids async-factory hoisting issues.
// filterDiffContextToFiles is inlined so tests see correct UserInputError for empty selections.
vi.mock("../git/diffCollector", () => ({
  collectDiffContext: vi.fn(),
  getBranchName: vi.fn(),
  getRepositoryName: vi.fn(),
  detectLanguageHints: vi.fn(),
  filterDiffContextToFiles: vi.fn((ctx: DiffContext, files: string[]) => {
    const selectedSet = new Set(files);
    const matchingFiles = ctx.files.filter((f) => selectedSet.has(f));
    if (matchingFiles.length === 0) return { ...ctx, diff: "", fullDiff: "", files: [] };
    return { ...ctx, files: matchingFiles };
  })
}));

vi.mock("../config/vscodeSettings", () => ({
  getAiCommitSettings: vi.fn(() => ({
    openRouterModel: "openai/gpt-4o",
    fallbackModel: "openai/gpt-4o-mini",
    includeUntrackedFiles: false,
    maxDiffCharacters: 60_000
  }))
}));

// Import mocked diffCollector functions for per-test setup.
import * as diffCollector from "../git/diffCollector";
import { showCommitReviewPanel } from "../ui/commitReviewPanel";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeDiffContext(overrides: Partial<DiffContext> = {}): DiffContext {
  return {
    diff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
    fullDiff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
    diffSource: "unstaged",
    files: ["src/a.ts"],
    excludedFiles: [],
    fileStats: { "src/a.ts": { added: 1, removed: 0 } },
    stats: { filesChanged: 1, linesAdded: 1, linesRemoved: 0 },
    truncated: false,
    warnings: [],
    maxDiffCharacters: 60_000,
    ...overrides
  };
}

function makeGitService(overrides: Partial<Record<keyof GitService, unknown>> = {}): GitService {
  return {
    hasChanges: vi.fn().mockResolvedValue(true),
    hasStagedChanges: vi.fn().mockResolvedValue(false),
    getUnpushedCommitCount: vi.fn().mockResolvedValue(0),
    getPushReadiness: vi
      .fn()
      .mockResolvedValue({ canPush: true, branchName: "main", remoteName: "origin" }),
    getHeadShortHash: vi.fn().mockResolvedValue("abc1234"),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    undoLastCommit: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as GitService;
}

function makeOpenRouterClient(
  overrides: Partial<Record<keyof OpenRouterClient, unknown>> = {}
): OpenRouterClient {
  return {
    generateCommitMessage: vi.fn().mockResolvedValue({
      content: JSON.stringify({ summary: "feat: add thing", description: "details", riskLevel: "low" }),
      modelUsed: "openai/gpt-4o"
    }),
    ...overrides
  } as unknown as OpenRouterClient;
}

function makeContext(): vscode.ExtensionContext {
  return {
    secrets: {
      get: vi.fn().mockResolvedValue("sk-test-token"),
      store: vi.fn(),
      delete: vi.fn()
    },
    subscriptions: []
  } as unknown as vscode.ExtensionContext;
}

/** Run generateCommitMessage and capture the handlers passed to showCommitReviewPanel. */
async function runAndCaptureHandlers(
  gitService: GitService,
  openRouterClient?: OpenRouterClient
): Promise<{ handlers: CommitReviewHandlers; initialData: CommitReviewData }> {
  vi.mocked(showCommitReviewPanel).mockClear();

  await generateCommitMessage(makeContext(), {
    gitService,
    openRouterClient: openRouterClient ?? makeOpenRouterClient()
  });

  expect(showCommitReviewPanel).toHaveBeenCalledOnce();
  const [initialData, handlers] = vi.mocked(showCommitReviewPanel).mock.calls[0] as [
    CommitReviewData,
    CommitReviewHandlers
  ];
  return { handlers, initialData };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("generateCommitMessage", () => {
  beforeEach(() => {
    const { resetVscodeMocks } = vscode as unknown as { resetVscodeMocks: () => void };
    resetVscodeMocks();

    // Reset diffCollector mocks to sensible defaults after vi.clearAllMocks().
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("my-repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue(["TypeScript"]);
  });

  // ── initial panel state ───────────────────────────────────────────────────

  describe("initial panel state", () => {
    it("shows info and skips panel when repo is clean with no pending pushes", async () => {
      const git = makeGitService({
        hasChanges: vi.fn().mockResolvedValue(false),
        getUnpushedCommitCount: vi.fn().mockResolvedValue(0)
      });

      vi.mocked(showCommitReviewPanel).mockClear();
      await generateCommitMessage(makeContext(), { gitService: git });

      expect(showCommitReviewPanel).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("No Git changes")
      );
    });

    it("opens the panel when there are unstaged changes", async () => {
      const { initialData } = await runAndCaptureHandlers(makeGitService());
      expect(initialData.diffContext.files).toContain("src/a.ts");
      expect(initialData.canPush).toBe(true);
      expect(initialData.commitState).toBeUndefined();
    });

    it("opens in pendingPush state when commits exist but no local changes", async () => {
      const git = makeGitService({
        hasChanges: vi.fn().mockResolvedValue(true),
        getUnpushedCommitCount: vi.fn().mockResolvedValue(2)
      });
      vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(
        makeDiffContext({ files: [], diff: "", fullDiff: "" })
      );

      const { initialData } = await runAndCaptureHandlers(git);
      expect(initialData.pendingPushCount).toBe(2);
    });

    it("reflects canPush:false from getPushReadiness in initial data", async () => {
      const git = makeGitService({
        getPushReadiness: vi.fn().mockResolvedValue({
          canPush: false,
          reason: "No Git remote is configured.",
          branchName: "main"
        })
      });

      const { initialData } = await runAndCaptureHandlers(git);
      expect(initialData.canPush).toBe(false);
      expect(initialData.pushDisabledReason).toBe("No Git remote is configured.");
    });
  });

  // ── generate handler ──────────────────────────────────────────────────────

  describe("generate handler", () => {
    it("throws UserInputError when no files are selected", async () => {
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await expect(handlers.generate([])).rejects.toBeInstanceOf(UserInputError);
    });

    it("returns generated message data on success", async () => {
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      const result = await handlers.generate(["src/a.ts"]);
      expect(result.message?.summary).toBe("feat: add thing");
      expect(result.modelUsed).toBe("openai/gpt-4o");
    });

    it("throws NetworkError on API timeout", async () => {
      const client = makeOpenRouterClient({
        generateCommitMessage: vi.fn().mockRejectedValue(
          new Error("OpenRouter request timed out after 30000ms.")
        )
      });

      const { handlers } = await runAndCaptureHandlers(makeGitService(), client);
      await expect(handlers.generate(["src/a.ts"])).rejects.toBeInstanceOf(NetworkError);
    });

    it("throws NetworkError with auth message on 401", async () => {
      const client = makeOpenRouterClient({
        generateCommitMessage: vi.fn().mockRejectedValue(
          new Error("OpenRouter returned 401: Unauthorized (authentication error)")
        )
      });

      const { handlers } = await runAndCaptureHandlers(makeGitService(), client);
      const err = await handlers.generate(["src/a.ts"]).catch((e) => e);
      expect(err).toBeInstanceOf(NetworkError);
      expect((err as NetworkError).userMessage).toMatch(/API key/i);
    });

    it("includes fresh pushReadiness in the returned data", async () => {
      const git = makeGitService({
        getPushReadiness: vi
          .fn()
          .mockResolvedValueOnce({ canPush: true, branchName: "main", remoteName: "origin" })
          .mockResolvedValueOnce({ canPush: false, reason: "Detached HEAD", branchName: "HEAD" })
      });

      const { handlers } = await runAndCaptureHandlers(git);
      const result = await handlers.generate(["src/a.ts"]);
      expect(result.canPush).toBe(false);
      expect(result.pushDisabledReason).toBe("Detached HEAD");
    });
  });

  // ── commit handler ────────────────────────────────────────────────────────

  describe("commit handler", () => {
    it("returns undefined when user cancels the confirmation dialog", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue(undefined);
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await handlers.generate(["src/a.ts"]);
      const result = await handlers.commit("feat: my change");
      expect(result).toBeUndefined();
    });

    it("throws UserInputError for an empty commit message", async () => {
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await handlers.generate(["src/a.ts"]);
      await expect(handlers.commit("   ")).rejects.toBeInstanceOf(UserInputError);
    });

    it("throws UserInputError when committing before generating", async () => {
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await expect(handlers.commit("feat: early commit")).rejects.toBeInstanceOf(UserInputError);
    });

    it("returns committed state after a successful commit", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Stage and Commit");
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await handlers.generate(["src/a.ts"]);
      const result = await handlers.commit("feat: my change");
      expect(result?.commitState?.status).toBe("committed");
    });

    it("propagates GitOperationError when git commit fails", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Stage and Commit");
      const git = makeGitService({
        commit: vi
          .fn()
          .mockRejectedValue(new GitOperationError("Index locked. Close other git tools."))
      });

      const { handlers } = await runAndCaptureHandlers(git);
      await handlers.generate(["src/a.ts"]);
      await expect(handlers.commit("feat: my change")).rejects.toBeInstanceOf(GitOperationError);
    });
  });

  // ── push handler ─────────────────────────────────────────────────────────

  describe("push handler", () => {
    it("returns undefined when user cancels the confirmation dialog", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue(undefined);
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      const result = await handlers.push();
      expect(result).toBeUndefined();
    });

    it("returns pushed state after a successful push", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Push");
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      const result = await handlers.push();
      expect(result?.commitState?.status).toBe("pushed");
    });

    it("propagates GitOperationError with friendly message on push rejection", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Push");
      const git = makeGitService({
        push: vi.fn().mockRejectedValue(
          new GitOperationError(
            "Push rejected — remote has commits you don't have locally. Pull first."
          )
        )
      });

      const { handlers } = await runAndCaptureHandlers(git);
      const err = await handlers.push().catch((e) => e);
      expect(err).toBeInstanceOf(GitOperationError);
      expect(err.userMessage).toMatch(/Pull first/);
    });

    it("re-throws GitOperationError when push fails", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Push");
      const pushErr = new GitOperationError("Push rejected — remote has commits.");
      const git = makeGitService({ push: vi.fn().mockRejectedValue(pushErr) });
      const { handlers } = await runAndCaptureHandlers(git);
      await expect(handlers.push()).rejects.toThrow("Push rejected");
    });

    it("shows plain error and returns undefined when canPush is false", async () => {
      const git = makeGitService({
        getPushReadiness: vi.fn().mockResolvedValue({
          canPush: false,
          reason: "No Git remote is configured.",
          branchName: "main"
        })
      });

      const { handlers } = await runAndCaptureHandlers(git);
      const result = await handlers.push();
      expect(result).toBeUndefined();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("No Git remote")
      );
    });
  });

  // ── commitAndPush handler ─────────────────────────────────────────────────

  describe("commitAndPush handler", () => {
    it("returns committed state when push is cancelled after commit", async () => {
      vscode.window.showWarningMessage = vi
        .fn()
        .mockResolvedValueOnce("Stage and Commit")
        .mockResolvedValueOnce(undefined);

      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await handlers.generate(["src/a.ts"]);
      const result = await handlers.commitAndPush("feat: both");
      expect(result?.commitState?.status).toBe("committed");
    });

    it("returns pushed state when both commit and push succeed", async () => {
      vscode.window.showWarningMessage = vi
        .fn()
        .mockResolvedValueOnce("Stage and Commit")
        .mockResolvedValueOnce("Push");

      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await handlers.generate(["src/a.ts"]);
      const result = await handlers.commitAndPush("feat: both");
      expect(result?.commitState?.status).toBe("pushed");
    });
  });

  // ── undoCommit handler ────────────────────────────────────────────────────

  describe("undoCommit handler", () => {
    it("returns undefined when user cancels", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue(undefined);
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      const result = await handlers.undoCommit();
      expect(result).toBeUndefined();
    });

    it("returns updated diff context after undo", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Undo Commit");
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      const result = await handlers.undoCommit();
      expect(result?.diffContext).toBeDefined();
      expect(result?.commitState).toBeUndefined();
    });

    it("propagates GitOperationError when git reset fails", async () => {
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Undo Commit");
      const git = makeGitService({
        undoLastCommit: vi
          .fn()
          .mockRejectedValue(
            new GitOperationError("Nothing to undo — no commits on this branch.")
          )
      });

      const { handlers } = await runAndCaptureHandlers(git);
      await expect(handlers.undoCommit()).rejects.toBeInstanceOf(GitOperationError);
    });
  });

  // ── reviewChanges handler ─────────────────────────────────────────────────

  describe("reviewChanges handler", () => {
    it("returns refreshed diff context", async () => {
      const { handlers } = await runAndCaptureHandlers(makeGitService());
      const result = await handlers.reviewChanges();
      expect(result?.diffContext.files).toContain("src/a.ts");
    });

    it("throws UserInputError when no safe changes remain after refresh", async () => {
      vi.mocked(diffCollector.collectDiffContext)
        .mockResolvedValueOnce(makeDiffContext()) // initial load
        .mockResolvedValueOnce(makeDiffContext({ files: [], diff: "", fullDiff: "" })); // refresh

      const { handlers } = await runAndCaptureHandlers(makeGitService());
      await expect(handlers.reviewChanges()).rejects.toBeInstanceOf(UserInputError);
    });
  });
});
