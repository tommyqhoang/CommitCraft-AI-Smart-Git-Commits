import { randomBytes } from "node:crypto";

import * as vscode from "vscode";

import { renderCommitAssistantHtml, type CommitAssistantData } from "./commitAssistantHtml";

export type CommitReviewData = CommitAssistantData;

export interface CommitReviewHandlers {
  generate: (files: string[]) => Promise<CommitReviewData>;
  commit: (message: string) => Promise<void>;
  push: () => Promise<void>;
  commitAndPush: (message: string) => Promise<void>;
}

export function showCommitReviewPanel(
  data: CommitReviewData,
  handlers: CommitReviewHandlers
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
    void handleMessage(message, handlers, panel).finally(() => {
      isActionInProgress = false;
    });
  });
  panel.onDidDispose(() => messageListener.dispose());
  return panel;
}

async function handleMessage(
  message: unknown,
  handlers: CommitReviewHandlers,
  panel: vscode.WebviewPanel
): Promise<void> {
  if (!isWebviewMessage(message)) {
    return;
  }

  try {
    if (message.command === "generate") {
      const updatedData = await handlers.generate(message.files ?? []);
      setPanelHtml(panel, updatedData);
    } else if (message.command === "commit") {
      await handlers.commit(message.message ?? "");
    } else if (message.command === "push") {
      await handlers.push();
    } else if (message.command === "commitAndPush") {
      await handlers.commitAndPush(message.message ?? "");
    }
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    void panel.webview.postMessage({ command: "error", text: errorText });
  }
}

function setPanelHtml(panel: vscode.WebviewPanel, data: CommitReviewData): void {
  panel.webview.html = renderCommitAssistantHtml(data, {
    cspSource: panel.webview.cspSource,
    nonce: getNonce()
  });
}

function isWebviewMessage(value: unknown): value is {
  command: string;
  message?: string;
  files?: string[];
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "command" in value &&
    typeof value.command === "string" &&
    (!("message" in value) || typeof value.message === "string") &&
    (!("files" in value) ||
      (Array.isArray(value.files) && value.files.every((file) => typeof file === "string")))
  );
}

function getNonce(): string {
  return randomBytes(16).toString("hex");
}
