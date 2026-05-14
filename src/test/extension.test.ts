import { beforeEach, describe, expect, it, vi } from "vitest";

import * as vscode from "vscode";

vi.mock("../commands/generateCommitMessage", () => ({
  generateCommitMessage: vi.fn()
}));

vi.mock("../commands/setOpenRouterToken", () => ({
  setOpenRouterToken: vi.fn()
}));

vi.mock("../commands/clearOpenRouterToken", () => ({
  clearOpenRouterToken: vi.fn()
}));

import { activate, deactivate } from "../extension";
import { clearOpenRouterToken } from "../commands/clearOpenRouterToken";
import { generateCommitMessage } from "../commands/generateCommitMessage";
import { setOpenRouterToken } from "../commands/setOpenRouterToken";
import { resetVscodeMocks } from "./mocks/vscode";

function makeContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    secrets: {
      get: vi.fn(),
      store: vi.fn(),
      delete: vi.fn()
    }
  } as unknown as vscode.ExtensionContext;
}

function registeredCommand(name: string): () => Promise<void> | void {
  const match = vi
    .mocked(vscode.commands.registerCommand)
    .mock.calls.find(([command]) => command === name);
  if (!match) {
    throw new Error(`Command ${name} was not registered`);
  }
  return match[1] as () => Promise<void> | void;
}

beforeEach(() => {
  resetVscodeMocks();
  vi.mocked(generateCommitMessage).mockReset();
  vi.mocked(setOpenRouterToken).mockReset();
  vi.mocked(clearOpenRouterToken).mockReset();
});

describe("extension activation", () => {
  it("registers commands and shows the CommitCraft status bar item", () => {
    const context = makeContext();

    activate(context);

    expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
      vscode.StatusBarAlignment.Left,
      100
    );
    const statusBar = vi.mocked(vscode.window.createStatusBarItem).mock.results[0]?.value;
    expect(statusBar.command).toBe("commitCraft.openCommitAssistant");
    expect(statusBar.text).toBe("$(sparkle) CommitCraft");
    expect(statusBar.show).toHaveBeenCalled();
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "commitCraft.openCommitAssistant",
      expect.any(Function)
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "commitCraft.generateCommitMessage",
      expect.any(Function)
    );
    expect(context.subscriptions).toHaveLength(5);
  });

  it("opens a generated panel and reuses it until disposal", async () => {
    const panel = {
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
      dispose: vi.fn()
    } as unknown as vscode.WebviewPanel;
    vi.mocked(generateCommitMessage).mockResolvedValue(panel);
    const context = makeContext();

    activate(context);
    const open = registeredCommand("commitCraft.openCommitAssistant");
    await open();
    await open();

    expect(generateCommitMessage).toHaveBeenCalledOnce();
    expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);

    const disposeHandler = vi.mocked(panel.onDidDispose).mock.calls[0]?.[0] as () => void;
    disposeHandler();
    await open();
    expect(generateCommitMessage).toHaveBeenCalledTimes(2);
  });

  it("leaves active panel empty when generation does not return a panel", async () => {
    vi.mocked(generateCommitMessage).mockResolvedValue(undefined);
    const context = makeContext();

    activate(context);
    const open = registeredCommand("commitCraft.generateCommitMessage");
    await open();
    await open();

    expect(generateCommitMessage).toHaveBeenCalledTimes(2);
  });

  it("registers token management commands", async () => {
    const context = makeContext();

    activate(context);
    await registeredCommand("commitCraft.setOpenRouterToken")();
    await registeredCommand("commitCraft.clearOpenRouterToken")();

    expect(setOpenRouterToken).toHaveBeenCalledWith(context);
    expect(clearOpenRouterToken).toHaveBeenCalledWith(context);
  });
});

describe("deactivate", () => {
  it("does not throw", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
