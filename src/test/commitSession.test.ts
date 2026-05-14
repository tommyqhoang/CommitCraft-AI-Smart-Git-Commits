import { describe, it, expect, vi, beforeEach } from "vitest";

// vscode resolves to src/test/mocks/vscode.ts via vitest alias
import * as vscode from "vscode";

import { CommitSession, classifyNetworkError } from "../commands/commitSession";
import { GitService } from "../git/gitService";
import { OpenRouterClient } from "../openrouter/openRouterClient";
import { NetworkError, UserInputError } from "../errors";
import type { DiffContext } from "../git/diffCollector";
import type { AiCommitSettings } from "../config/settings";

// ─── module mocks ────────────────────────────────────────────────────────────

vi.mock("../git/diffCollector", () => ({
  collectDiffContext: vi.fn(),
  filterDiffContextToFiles: vi.fn((ctx: DiffContext, files: string[]) => {
    const selectedSet = new Set(files);
    const matchingFiles = ctx.files.filter((f) => selectedSet.has(f));
    if (matchingFiles.length === 0) return { ...ctx, diff: "", fullDiff: "", files: [] };
    return { ...ctx, files: matchingFiles };
  }),
  getBranchName: vi.fn(),
  getRepositoryName: vi.fn(),
  detectLanguageHints: vi.fn()
}));

vi.mock("../openrouter/commitPrompt", () => ({
  buildCommitPrompt: vi.fn().mockReturnValue("stub prompt")
}));

vi.mock("../openrouter/responseParser", () => ({
  parseCommitResponse: vi.fn().mockReturnValue({
    message: { summary: "feat: add thing", description: "details", riskLevel: "low" },
    recovered: false,
    recoveryReason: undefined
  })
}));

vi.mock("../ui/notifications", () => ({
  confirmAction: vi.fn(),
  showInfo: vi.fn().mockResolvedValue(undefined),
  showPlainError: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../commands/setOpenRouterToken", () => ({
  setOpenRouterToken: vi.fn().mockResolvedValue(true)
}));

import * as diffCollector from "../git/diffCollector";
import * as notifications from "../ui/notifications";

// ─── helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AiCommitSettings = {
  openRouterModel: "openai/gpt-4o",
  fallbackModel: "openai/gpt-4o-mini",
  includeUntrackedFiles: false,
  maxDiffCharacters: 60_000,
  skipCommitConfirmation: false
};

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
      content: JSON.stringify({
        summary: "feat: add thing",
        description: "details",
        riskLevel: "low"
      }),
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

function makeSession(
  overrides: {
    gitService?: GitService;
    openRouterClient?: OpenRouterClient;
    context?: vscode.ExtensionContext;
    settings?: AiCommitSettings;
    initialDiffContext?: DiffContext;
  } = {}
): CommitSession {
  return new CommitSession(
    {
      gitService: overrides.gitService ?? makeGitService(),
      openRouterClient: overrides.openRouterClient ?? makeOpenRouterClient(),
      context: overrides.context ?? makeContext(),
      settings: overrides.settings ?? DEFAULT_SETTINGS,
      workspacePath: "/test/workspace"
    },
    overrides.initialDiffContext ?? makeDiffContext()
  );
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("CommitSession", () => {
  beforeEach(() => {
    const { resetVscodeMocks } = vscode as unknown as { resetVscodeMocks: () => void };
    resetVscodeMocks();
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("my-repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue(["TypeScript"]);
    vi.mocked(notifications.confirmAction).mockResolvedValue(true);
  });

  // ── generate ─────────────────────────────────────────────────────────────

  describe("generate", () => {
    it("throws UserInputError when selected files produce an empty diff", async () => {
      const session = makeSession();
      await expect(session.generate([])).rejects.toBeInstanceOf(UserInputError);
    });

    it("returns generated message data on success", async () => {
      const session = makeSession();
      const result = await session.generate(["src/a.ts"]);
      expect(result.message?.summary).toBe("feat: add thing");
      expect(result.modelUsed).toBe("openai/gpt-4o");
    });

    it("throws UserInputError when no token is available and user declines prompt", async () => {
      const context = makeContext();
      (context.secrets.get as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue(undefined);
      const session = makeSession({ context });
      await expect(session.generate(["src/a.ts"])).rejects.toBeInstanceOf(UserInputError);
    });

    it("fetches token via prompt when secrets store is empty and user clicks Add API Key", async () => {
      const context = makeContext();
      (context.secrets.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce("sk-new-token");
      vscode.window.showWarningMessage = vi.fn().mockResolvedValue("Add API Key");
      const session = makeSession({ context });
      const result = await session.generate(["src/a.ts"]);
      expect(result.message?.summary).toBe("feat: add thing");
    });

    it("throws NetworkError on API timeout", async () => {
      const client = makeOpenRouterClient({
        generateCommitMessage: vi
          .fn()
          .mockRejectedValue(new Error("OpenRouter request timed out after 30000ms."))
      });
      const session = makeSession({ openRouterClient: client });
      await expect(session.generate(["src/a.ts"])).rejects.toBeInstanceOf(NetworkError);
    });

    it("includes fresh push readiness in returned data", async () => {
      const git = makeGitService({
        getPushReadiness: vi
          .fn()
          .mockResolvedValue({ canPush: false, reason: "Detached HEAD", branchName: "HEAD" })
      });
      const session = makeSession({ gitService: git });
      const result = await session.generate(["src/a.ts"]);
      expect(result.canPush).toBe(false);
      expect(result.pushDisabledReason).toBe("Detached HEAD");
    });
  });

  // ── regenerate ───────────────────────────────────────────────────────────

  describe("regenerate", () => {
    it("throws UserInputError before any generate call", async () => {
      const session = makeSession();
      await expect(session.regenerate()).rejects.toBeInstanceOf(UserInputError);
    });

    it("re-uses the same diff context from the prior generate call", async () => {
      const session = makeSession();
      await session.generate(["src/a.ts"]);
      const result = await session.regenerate();
      expect(result.message?.summary).toBe("feat: add thing");
    });
  });

  // ── commit ───────────────────────────────────────────────────────────────

  describe("commit", () => {
    it("throws UserInputError when committing before generating", async () => {
      const session = makeSession();
      await expect(session.commit("feat: my change")).rejects.toBeInstanceOf(UserInputError);
    });

    it("throws UserInputError for an empty commit message", async () => {
      const session = makeSession();
      await session.generate(["src/a.ts"]);
      await expect(session.commit("   ")).rejects.toBeInstanceOf(UserInputError);
    });

    it("returns undefined when user cancels the confirmation dialog", async () => {
      vi.mocked(notifications.confirmAction).mockResolvedValue(false);
      const session = makeSession();
      await session.generate(["src/a.ts"]);
      const result = await session.commit("feat: my change");
      expect(result).toBeUndefined();
    });

    it("returns committed state and appends to activity history on success", async () => {
      const session = makeSession();
      await session.generate(["src/a.ts"]);
      const result = await session.commit("feat: my change");
      expect(result?.commitState?.status).toBe("committed");
      expect(result?.commitState?.commitHash).toBe("abc1234");
      expect(session.activityHistory).toHaveLength(1);
      expect(session.activityHistory[0].type).toBe("commit");
    });

    it("skips confirmation dialog when skipCommitConfirmation is true", async () => {
      const session = makeSession({
        settings: { ...DEFAULT_SETTINGS, skipCommitConfirmation: true }
      });
      await session.generate(["src/a.ts"]);
      const result = await session.commit("feat: skip confirm");
      expect(result?.commitState?.status).toBe("committed");
      expect(notifications.confirmAction).not.toHaveBeenCalled();
    });

    it("uses staged-changes dialog text when hasStagedChanges is true", async () => {
      const git = makeGitService({
        hasStagedChanges: vi.fn().mockResolvedValue(true)
      });
      const session = makeSession({ gitService: git });
      await session.generate(["src/a.ts"]);
      await session.commit("feat: staged");
      expect(notifications.confirmAction).toHaveBeenCalledWith(
        expect.stringContaining("staged changes"),
        "Commit Staged Changes"
      );
    });
  });

  // ── push ─────────────────────────────────────────────────────────────────

  describe("push", () => {
    it("returns undefined and shows error when push is not ready", async () => {
      const git = makeGitService({
        getPushReadiness: vi
          .fn()
          .mockResolvedValue({ canPush: false, reason: "No remote configured.", branchName: "main" })
      });
      const session = makeSession({ gitService: git });
      const result = await session.push();
      expect(result).toBeUndefined();
      expect(notifications.showPlainError).toHaveBeenCalledWith("No remote configured.");
    });

    it("returns undefined when user cancels push confirmation", async () => {
      vi.mocked(notifications.confirmAction).mockResolvedValue(false);
      const session = makeSession();
      const result = await session.push();
      expect(result).toBeUndefined();
    });

    it("returns pushed state and records push activity on success", async () => {
      const session = makeSession();
      const result = await session.push();
      expect(result?.commitState?.status).toBe("pushed");
      expect(session.activityHistory).toHaveLength(1);
      expect(session.activityHistory[0].type).toBe("push");
      expect(session.activityHistory[0].detail).toBe("main to origin");
    });
  });

  // ── commitAndPush ────────────────────────────────────────────────────────

  describe("commitAndPush", () => {
    it("returns undefined when user cancels the commit dialog", async () => {
      vi.mocked(notifications.confirmAction).mockResolvedValue(false);
      const session = makeSession();
      await session.generate(["src/a.ts"]);
      const result = await session.commitAndPush("feat: my change");
      expect(result).toBeUndefined();
    });

    it("returns committed state when push fails after a successful commit", async () => {
      const git = makeGitService({
        push: vi.fn().mockRejectedValue(new Error("Push rejected by remote"))
      });
      const session = makeSession({ gitService: git });
      await session.generate(["src/a.ts"]);
      const result = await session.commitAndPush("feat: my change");
      expect(result?.commitState?.status).toBe("committed");
      expect(notifications.showPlainError).toHaveBeenCalled();
      expect(session.activityHistory.some((h) => h.type === "commit")).toBe(true);
      expect(session.activityHistory.some((h) => h.type === "push")).toBe(false);
    });

    it("returns pushed state and records both activities on full success", async () => {
      const session = makeSession();
      await session.generate(["src/a.ts"]);
      const result = await session.commitAndPush("feat: my change");
      expect(result?.commitState?.status).toBe("pushed");
      expect(session.activityHistory.some((h) => h.type === "commit")).toBe(true);
      expect(session.activityHistory.some((h) => h.type === "push")).toBe(true);
    });
  });

  // ── undoCommit ───────────────────────────────────────────────────────────

  describe("undoCommit", () => {
    it("returns undefined when user cancels", async () => {
      vi.mocked(notifications.confirmAction).mockResolvedValue(false);
      const session = makeSession();
      const result = await session.undoCommit();
      expect(result).toBeUndefined();
    });

    it("refreshes diff context, resets generated state, and records undo activity", async () => {
      const freshCtx = makeDiffContext({ files: ["src/b.ts"] });
      vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(freshCtx);
      const session = makeSession();
      // Generate first so there is generated state to reset
      await session.generate(["src/a.ts"]);
      const result = await session.undoCommit();
      expect(result?.diffContext.files).toContain("src/b.ts");
      expect(session.activityHistory.some((h) => h.type === "undo")).toBe(true);
    });

    it("returns canReviewChanges:false when the refreshed diff is empty", async () => {
      vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(
        makeDiffContext({ files: [], diff: "", fullDiff: "" })
      );
      const session = makeSession();
      const result = await session.undoCommit();
      expect(result?.canReviewChanges).toBe(false);
    });
  });

  // ── reviewChanges ────────────────────────────────────────────────────────

  describe("reviewChanges", () => {
    it("throws UserInputError when no safe changes remain after refresh", async () => {
      vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(
        makeDiffContext({ diff: "", fullDiff: "", files: [] })
      );
      const session = makeSession();
      await expect(session.reviewChanges()).rejects.toBeInstanceOf(UserInputError);
    });

    it("returns refreshed diff context and resets generated state on success", async () => {
      const freshCtx = makeDiffContext({ files: ["src/b.ts"] });
      vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(freshCtx);
      const session = makeSession();
      await session.generate(["src/a.ts"]);
      const result = await session.reviewChanges();
      expect(result?.diffContext.files).toContain("src/b.ts");
      expect(result?.canReviewChanges).toBe(true);
    });
  });
});

// ─── classifyNetworkError ─────────────────────────────────────────────────────

describe("classifyNetworkError", () => {
  it("passes through an existing NetworkError unchanged", () => {
    const original = new NetworkError("already classified");
    expect(classifyNetworkError(original)).toBe(original);
  });

  it("classifies timeout errors", () => {
    const err = classifyNetworkError(new Error("OpenRouter request timed out after 30000ms."));
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toMatch(/timed out/i);
  });

  it("classifies 401 authentication errors", () => {
    const err = classifyNetworkError(
      new Error("OpenRouter returned 401: Unauthorized (authentication error)")
    );
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toMatch(/API key/i);
  });

  it("classifies 403 authentication errors", () => {
    const err = classifyNetworkError(new Error("OpenRouter returned 403: Forbidden"));
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toMatch(/API key/i);
  });

  it("classifies 429 rate-limit errors", () => {
    const err = classifyNetworkError(new Error("429 rate limit exceeded"));
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toMatch(/rate limit/i);
  });

  it("classifies 5xx server errors", () => {
    const err = classifyNetworkError(new Error("503 service unavailable"));
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toMatch(/unavailable/i);
  });

  it("classifies internal server errors by phrase", () => {
    const err = classifyNetworkError(new Error("500 internal server error"));
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toMatch(/unavailable/i);
  });

  it("wraps unknown errors using their message as the user message", () => {
    const err = classifyNetworkError(new Error("some unexpected failure"));
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toBe("some unexpected failure");
  });

  it("handles non-Error thrown values", () => {
    const err = classifyNetworkError("plain string error");
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.userMessage).toBe("plain string error");
  });
});
