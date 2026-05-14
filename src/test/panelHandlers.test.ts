import { describe, expect, it, vi, beforeEach } from "vitest";

import * as vscode from "vscode";

import type { CommitReviewData, CommitReviewHandlers } from "../ui/commitReviewPanel";
import { showCommitReviewPanel } from "../ui/commitReviewPanel";
import { setOpenRouterToken } from "../commands/setOpenRouterToken";
import { clearOpenRouterToken } from "../commands/clearOpenRouterToken";
import { getAiCommitSettings } from "../config/vscodeSettings";
import { UserInputError } from "../errors";
import type { DiffContext } from "../git/diffCollector";
import { resetVscodeMocks } from "./mocks/vscode";

// ─── fixtures ────────────────────────────────────────────────────────────────

const baseDiffContext: DiffContext = {
  diff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  fullDiff: "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  diffSource: "unstaged" as const,
  files: ["src/a.ts"],
  excludedFiles: [],
  fileStats: { "src/a.ts": { added: 1, removed: 0 } },
  stats: { filesChanged: 1, linesAdded: 1, linesRemoved: 0 },
  truncated: false,
  warnings: [],
  maxDiffCharacters: 60_000
};

const baseReviewData: CommitReviewData = {
  diffContext: baseDiffContext,
  canPush: true,
  recovered: false,
  pendingPushCount: 0
};

function makeHandlers(overrides: Partial<CommitReviewHandlers> = {}): CommitReviewHandlers {
  return {
    generate: vi.fn().mockResolvedValue({
      ...baseReviewData,
      message: { summary: "feat: generated", description: "", riskLevel: "low" }
    }),
    regenerate: vi.fn().mockResolvedValue({
      ...baseReviewData,
      message: { summary: "feat: regenerated", description: "", riskLevel: "low" }
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    commitAndPush: vi.fn().mockResolvedValue(undefined),
    undoCommit: vi.fn().mockResolvedValue(undefined),
    reviewChanges: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function getListener(panel: vscode.WebviewPanel): (message: unknown) => Promise<void> {
  return vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0] as (
    message: unknown
  ) => Promise<void>;
}

async function flushPanelWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  resetVscodeMocks();
});

// ─── showCommitReviewPanel ────────────────────────────────────────────────────

describe("showCommitReviewPanel", () => {
  it("creates a webview panel and renders initial HTML", () => {
    const panel = showCommitReviewPanel(baseReviewData, makeHandlers(), "/workspace");
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      "commitCraft.review",
      "CommitCraft Review",
      vscode.ViewColumn.One,
      expect.objectContaining({ enableScripts: true })
    );
    expect(panel.webview.html).toContain("CommitCraft");
  });

  it("sets panel title to 'CommitCraft — Review' when message is set", () => {
    const data: CommitReviewData = {
      ...baseReviewData,
      message: { summary: "feat: something", description: "", riskLevel: "low" }
    };
    const panel = showCommitReviewPanel(data, makeHandlers(), "/workspace");
    expect(panel.title).toBe("CommitCraft — Review");
  });

  it("sets panel title to 'CommitCraft — Committed' on committed state", () => {
    const data: CommitReviewData = {
      ...baseReviewData,
      commitState: { status: "committed", commitHash: "abc" }
    };
    const panel = showCommitReviewPanel(data, makeHandlers(), "/workspace");
    expect(panel.title).toBe("CommitCraft — Committed");
  });

  it("sets panel title to 'CommitCraft — Pushed' on pushed state", () => {
    const data: CommitReviewData = {
      ...baseReviewData,
      commitState: { status: "pushed", commitHash: "abc" }
    };
    const panel = showCommitReviewPanel(data, makeHandlers(), "/workspace");
    expect(panel.title).toBe("CommitCraft — Pushed");
  });

  it("sets panel title to 'CommitCraft — Ready to Push' on pendingPush state", () => {
    const data: CommitReviewData = {
      ...baseReviewData,
      commitState: { status: "pendingPush" }
    };
    const panel = showCommitReviewPanel(data, makeHandlers(), "/workspace");
    expect(panel.title).toBe("CommitCraft — Ready to Push");
  });

  it("disposes the message listener when the panel is disposed", () => {
    const panel = showCommitReviewPanel(baseReviewData, makeHandlers(), "/workspace");
    const disposeListener = vi.mocked(panel.webview.onDidReceiveMessage).mock.results[0].value as {
      dispose: () => void;
    };
    const onDidDisposeCb = vi.mocked(panel.onDidDispose).mock.calls[0][0] as () => void;
    onDidDisposeCb();
    expect(disposeListener.dispose).toHaveBeenCalled();
  });
});

// ─── message handlers ─────────────────────────────────────────────────────────

describe("panel message handlers", () => {
  it("calls generate and updates HTML", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "generate", files: ["src/a.ts"] });
    expect(handlers.generate).toHaveBeenCalledWith(["src/a.ts"]);
    expect(panel.webview.html).toContain("feat: generated");
  });

  it("calls regenerate and updates HTML", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "regenerate" });
    expect(handlers.regenerate).toHaveBeenCalled();
    expect(panel.webview.html).toContain("feat: regenerated");
  });

  it("calls commit handler and updates HTML when data returned", async () => {
    const handlers = makeHandlers({
      commit: vi.fn().mockResolvedValue({
        ...baseReviewData,
        commitState: { status: "committed", commitHash: "abc" }
      })
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "commit", message: "fix: something" });
    expect(handlers.commit).toHaveBeenCalledWith("fix: something");
    expect(panel.title).toBe("CommitCraft — Committed");
  });

  it("does not update panel when commit returns undefined (user cancelled)", async () => {
    const handlers = makeHandlers({ commit: vi.fn().mockResolvedValue(undefined) });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const htmlBefore = panel.webview.html;
    await getListener(panel)({ command: "commit", message: "fix: x" });
    expect(panel.webview.html).toBe(htmlBefore);
  });

  it("calls push handler", async () => {
    const handlers = makeHandlers({
      push: vi.fn().mockResolvedValue({ ...baseReviewData, commitState: { status: "pushed" } })
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "push" });
    expect(handlers.push).toHaveBeenCalled();
  });

  it("calls commitAndPush handler", async () => {
    const handlers = makeHandlers({
      commitAndPush: vi
        .fn()
        .mockResolvedValue({ ...baseReviewData, commitState: { status: "pushed" } })
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "commitAndPush", message: "feat: all" });
    expect(handlers.commitAndPush).toHaveBeenCalledWith("feat: all");
  });

  it("calls undoCommit handler", async () => {
    const handlers = makeHandlers({
      undoCommit: vi.fn().mockResolvedValue(baseReviewData)
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "undoCommit" });
    expect(handlers.undoCommit).toHaveBeenCalled();
  });

  it("calls reviewChanges handler", async () => {
    const handlers = makeHandlers({
      reviewChanges: vi.fn().mockResolvedValue(baseReviewData)
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "reviewChanges" });
    expect(handlers.reviewChanges).toHaveBeenCalled();
  });

  it("opens a file within the workspace", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "openFile", path: "src/a.ts" });
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/workspace/src/a.ts" })
    );
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
  });

  it("rejects openFile paths that escape the workspace boundary", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "openFile", path: "../../../etc/passwd" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: "error" })
    );
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it("posts error to webview when handler throws CommitCraftError", async () => {
    const handlers = makeHandlers({
      commit: vi.fn().mockRejectedValue(new UserInputError("Nothing selected."))
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "commit", message: "" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      command: "error",
      text: "Nothing selected."
    });
  });

  it("posts error to webview when handler throws generic Error", async () => {
    const handlers = makeHandlers({
      push: vi.fn().mockRejectedValue(new Error("git remote unreachable"))
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "push" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      command: "error",
      text: "git remote unreachable"
    });
  });

  it("posts stringified error for non-Error throws", async () => {
    const handlers = makeHandlers({
      push: vi.fn().mockRejectedValue("string error")
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)({ command: "push" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      command: "error",
      text: "string error"
    });
  });

  it("ignores unknown command strings without throwing", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    getListener(panel)({ command: "unknownXyz" });
    await flushPanelWork();
    expect(handlers.generate).not.toHaveBeenCalled();
  });

  it("ignores non-object messages", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    await getListener(panel)("not-an-object");
    await getListener(panel)(null);
    await getListener(panel)(42);
    expect(handlers.generate).not.toHaveBeenCalled();
  });

  it("blocks a second action while one is in progress", async () => {
    let resolve!: (v: CommitReviewData) => void;
    const pending = new Promise<CommitReviewData>((res) => {
      resolve = res;
    });
    const handlers = makeHandlers({ push: vi.fn().mockReturnValue(pending) });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = getListener(panel);
    void listener({ command: "push" });
    void listener({ command: "push" });
    resolve(baseReviewData);
    await pending;
    await new Promise((r) => setTimeout(r, 0));
    expect(handlers.push).toHaveBeenCalledTimes(1);
  });

  it("allows a second action after the first completes", async () => {
    const handlers = makeHandlers({
      push: vi.fn().mockResolvedValue(baseReviewData)
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = getListener(panel);
    listener({ command: "push" });
    await flushPanelWork();
    listener({ command: "push" });
    await flushPanelWork();
    expect(handlers.push).toHaveBeenCalledTimes(2);
  });
});

// ─── vscodeSettings ──────────────────────────────────────────────────────────

describe("getAiCommitSettings", () => {
  it("calls getConfiguration and returns parsed settings", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined)
    } as unknown as vscode.WorkspaceConfiguration);

    const settings = getAiCommitSettings();
    expect(settings.openRouterModel).toBe("openrouter/auto");
    expect(settings.skipCommitConfirmation).toBe(false);
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("commitCraft");
  });
});

// ─── setOpenRouterToken ───────────────────────────────────────────────────────

describe("setOpenRouterToken", () => {
  function makeContext() {
    return {
      secrets: {
        get: vi.fn().mockResolvedValue(undefined),
        store: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      subscriptions: []
    } as unknown as vscode.ExtensionContext;
  }

  it("stores token and returns true when user provides input", async () => {
    vi.mocked(vscode.window.showInputBox as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      "  sk-test-token  "
    );
    const ctx = makeContext();
    const result = await setOpenRouterToken(ctx);
    expect(result).toBe(true);
    expect(ctx.secrets.store).toHaveBeenCalledWith("commitCraft.openRouterToken", "sk-test-token");
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });

  it("configures the input box as a password field with blank-token validation", async () => {
    vi.mocked(vscode.window.showInputBox as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    const ctx = makeContext();

    await setOpenRouterToken(ctx);

    const options = vi.mocked(vscode.window.showInputBox).mock.calls[0]?.[0] as {
      password: boolean;
      ignoreFocusOut: boolean;
      validateInput: (value: string) => string | undefined;
    };
    expect(options.password).toBe(true);
    expect(options.ignoreFocusOut).toBe(true);
    expect(options.validateInput("   ")).toBe("Token cannot be empty.");
    expect(options.validateInput("sk-test")).toBeUndefined();
  });

  it("returns false when user cancels the input box", async () => {
    vi.mocked(vscode.window.showInputBox as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    const ctx = makeContext();
    const result = await setOpenRouterToken(ctx);
    expect(result).toBe(false);
    expect(ctx.secrets.store).not.toHaveBeenCalled();
  });
});

// ─── clearOpenRouterToken ─────────────────────────────────────────────────────

describe("clearOpenRouterToken", () => {
  it("deletes the token secret and shows info", async () => {
    const ctx = {
      secrets: { delete: vi.fn().mockResolvedValue(undefined) },
      subscriptions: []
    } as unknown as vscode.ExtensionContext;

    await clearOpenRouterToken(ctx);

    expect(ctx.secrets.delete).toHaveBeenCalledWith("commitCraft.openRouterToken");
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("cleared")
    );
  });
});
