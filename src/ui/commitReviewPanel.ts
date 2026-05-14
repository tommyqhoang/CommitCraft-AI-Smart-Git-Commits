import { randomBytes } from "node:crypto";
import path from "node:path";

import * as vscode from "vscode";

import { renderCommitAssistantHtml, type CommitAssistantData } from "./commitAssistantHtml";

export type CommitReviewData = CommitAssistantData;

export interface CommitReviewHandlers {
  generate: (files: string[]) => Promise<CommitReviewData>;
  commit: (message: string) => Promise<CommitReviewData | undefined>;
  push: () => Promise<CommitReviewData | undefined>;
  commitAndPush: (message: string) => Promise<CommitReviewData | undefined>;
  undoCommit: () => Promise<CommitReviewData | undefined>;
  reviewChanges: () => Promise<CommitReviewData | undefined>;
}

export function showCommitReviewPanel(
  data: CommitReviewData,
  handlers: CommitReviewHandlers,
  workspacePath: string
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "commitCraft.review",
    "CommitCraft Review",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: []
    }
  );

  setPanelHtml(panel, data);
  let isActionInProgress = false;
  const messageListener = panel.webview.onDidReceiveMessage((message: unknown) => {
    if (isActionInProgress) {
      return;
    }

    isActionInProgress = true;
    void handleMessage(message, handlers, panel, workspacePath).finally(() => {
      isActionInProgress = false;
    });
  });
  panel.onDidDispose(() => messageListener.dispose());
  return panel;
}

async function handleMessage(
  message: unknown,
  handlers: CommitReviewHandlers,
  panel: vscode.WebviewPanel,
  workspacePath: string
): Promise<void> {
  if (!isWebviewMessage(message)) {
    return;
  }

  try {
    if (message.command === "generate") {
      const updatedData = await handlers.generate(message.files ?? []);
      setPanelHtml(panel, updatedData);
    } else if (message.command === "commit") {
      updatePanelIfChanged(panel, await handlers.commit(message.message ?? ""));
    } else if (message.command === "push") {
      updatePanelIfChanged(panel, await handlers.push());
    } else if (message.command === "commitAndPush") {
      updatePanelIfChanged(panel, await handlers.commitAndPush(message.message ?? ""));
    } else if (message.command === "undoCommit") {
      updatePanelIfChanged(panel, await handlers.undoCommit());
    } else if (message.command === "reviewChanges") {
      updatePanelIfChanged(panel, await handlers.reviewChanges());
    } else if (message.command === "openFile" && message.path) {
      const resolvedBase = path.resolve(workspacePath);
      const resolvedTarget = path.resolve(path.join(workspacePath, message.path));
      if (
        resolvedTarget !== resolvedBase &&
        !resolvedTarget.startsWith(resolvedBase + path.sep)
      ) {
        throw new Error("Cannot open file outside the workspace.");
      }
      const uri = vscode.Uri.file(resolvedTarget);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
    }
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`CommitCraft: ${errorText}`);
    void panel.webview.postMessage({ command: "error", text: errorText });
  }
}

function updatePanelIfChanged(
  panel: vscode.WebviewPanel,
  data: CommitReviewData | undefined
): void {
  if (data) {
    setPanelHtml(panel, data);
  }
}

function setPanelHtml(panel: vscode.WebviewPanel, data: CommitReviewData): void {
  panel.title = getPanelTitle(data);
  panel.webview.html = renderCommitAssistantHtml(data, {
    cspSource: panel.webview.cspSource,
    nonce: getNonce()
  });
}

function getPanelTitle(data: CommitReviewData): string {
  if (data.commitState?.status === "pushed") return "CommitCraft — Pushed";
  if (data.commitState?.status === "pendingPush") return "CommitCraft — Ready to Push";
  if (data.commitState?.status === "committed") return "CommitCraft — Committed";
  if (data.message) return "CommitCraft — Review";
  return "CommitCraft";
}

function isWebviewMessage(value: unknown): value is {
  command: string;
  message?: string;
  files?: string[];
  path?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "command" in value &&
    typeof value.command === "string" &&
    (!("message" in value) || typeof value.message === "string") &&
    (!("files" in value) ||
      (Array.isArray(value.files) && value.files.every((file) => typeof file === "string"))) &&
    (!("path" in value) || typeof value.path === "string")
  );
}

function getNonce(): string {
  return randomBytes(16).toString("hex");
}
