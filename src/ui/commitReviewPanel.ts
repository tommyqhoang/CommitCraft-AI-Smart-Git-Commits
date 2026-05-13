import { randomBytes } from "node:crypto";

import * as vscode from "vscode";

import type { DiffContext } from "../git/diffCollector";
import type { GeneratedCommitMessage } from "../openrouter/responseParser";

export interface CommitReviewData {
  message: GeneratedCommitMessage;
  modelUsed: string;
  diffContext: DiffContext;
  recovered: boolean;
  recoveryReason?: string;
  canPush: boolean;
  pushDisabledReason?: string;
  showCommitAndPush: boolean;
}

export interface CommitReviewHandlers {
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

  panel.webview.html = renderHtml(panel.webview, data);
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
    if (message.command === "commit") {
      await handlers.commit(message.message);
    } else if (message.command === "push") {
      await handlers.push();
    } else if (message.command === "commitAndPush") {
      await handlers.commitAndPush(message.message);
    }
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    void panel.webview.postMessage({ command: "error", text: errorText });
  }
}

function renderHtml(webview: vscode.Webview, data: CommitReviewData): string {
  const nonce = getNonce();
  const messageText = `${data.message.summary}\n\n${data.message.description}`.trim();
  const warnings = [
    ...data.diffContext.warnings,
    data.recovered ? `Recovered non-JSON response: ${data.recoveryReason ?? "invalid JSON"}` : ""
  ].filter(Boolean);
  const files = data.diffContext.files.map((file) => `<li>${escapeHtml(file)}</li>`).join("");
  const warningHtml =
    warnings.length > 0
      ? `<section class="warnings">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</section>`
      : "";
  const pushTitle = data.canPush
    ? "Push the current branch"
    : (data.pushDisabledReason ?? "Push is unavailable for this repository state");
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CommitCraft Review</title>
  <style>
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); margin: 0; padding: 20px; }
    main { max-width: 920px; margin: 0 auto; display: grid; gap: 16px; }
    textarea { width: 100%; min-height: 180px; box-sizing: border-box; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); padding: 10px; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 8px 12px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
    dt { color: var(--vscode-descriptionForeground); }
    dd { margin: 0; }
    ul { margin-top: 8px; padding-left: 20px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .warnings { border-left: 3px solid var(--vscode-editorWarning-foreground); padding-left: 10px; color: var(--vscode-editorWarning-foreground); }
    .files { max-height: 180px; overflow: auto; border: 1px solid var(--vscode-panel-border); padding: 8px; }
    .muted { color: var(--vscode-descriptionForeground); margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>CommitCraft Review</h1>
    ${warningHtml}
    <section>
      <label for="message">Commit message</label>
      <textarea id="message">${escapeHtml(messageText)}</textarea>
    </section>
    <section>
      <dl>
        <dt>Model</dt><dd>${escapeHtml(data.modelUsed)}</dd>
        <dt>Diff source</dt><dd>${escapeHtml(data.diffContext.diffSource)}</dd>
        <dt>Files changed</dt><dd>${data.diffContext.stats.filesChanged}</dd>
        <dt>Lines added</dt><dd>${data.diffContext.stats.linesAdded}</dd>
        <dt>Lines removed</dt><dd>${data.diffContext.stats.linesRemoved}</dd>
        <dt>Risk</dt><dd>${escapeHtml(data.message.riskLevel)}</dd>
      </dl>
    </section>
    <section class="files">
      <strong>Affected files</strong>
      <ul>${files}</ul>
    </section>
    <section class="actions">
      <button id="commit">Commit</button>
      <button id="push" class="secondary" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Push</button>
      ${data.showCommitAndPush ? `<button id="commitAndPush" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Commit and Push</button>` : ""}
    </section>
    ${data.canPush ? "" : `<p class="muted">${escapeHtml(pushTitle)}</p>`}
    <p id="error" role="alert" style="color: var(--vscode-errorForeground); display: none;"></p>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const message = document.getElementById("message");
    const errorEl = document.getElementById("error");
    function showError(text) {
      errorEl.textContent = text;
      errorEl.style.display = "block";
    }
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg && msg.command === "error") {
        showError(msg.text);
      }
    });
    document.getElementById("commit").addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "commit", message: message.value });
    });
    document.getElementById("push").addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "push", message: message.value });
    });
    ${data.showCommitAndPush ? `document.getElementById("commitAndPush").addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "commitAndPush", message: message.value });
    });` : ""}
  </script>
</body>
</html>`;
}

function isWebviewMessage(value: unknown): value is { command: string; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "command" in value &&
    typeof value.command === "string" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getNonce(): string {
  return randomBytes(16).toString("hex"); // 32 hex chars, CSPRNG
}
