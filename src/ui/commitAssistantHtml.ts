import type { DiffContext } from "../git/diffCollector";
import type { GeneratedCommitMessage } from "../openrouter/responseParser";

export interface CommitAssistantData {
  message?: GeneratedCommitMessage;
  modelUsed?: string;
  diffContext: DiffContext;
  recovered: boolean;
  recoveryReason?: string;
  canPush: boolean;
  pushDisabledReason?: string;
}

export interface CommitAssistantRenderOptions {
  cspSource: string;
  nonce: string;
}

export function renderCommitAssistantHtml(
  data: CommitAssistantData,
  options: CommitAssistantRenderOptions
): string {
  const warnings = [
    ...data.diffContext.warnings,
    data.recovered ? `Recovered non-JSON response: ${data.recoveryReason ?? "invalid JSON"}` : ""
  ].filter(Boolean);
  const warningHtml =
    warnings.length > 0
      ? `<section class="warnings">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</section>`
      : "";
  const pushTitle = data.canPush
    ? "Push the current branch"
    : (data.pushDisabledReason ?? "Push is unavailable for this repository state");
  const csp = [
    "default-src 'none'",
    `style-src ${options.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${options.nonce}'`
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
    label.file { display: flex; gap: 8px; align-items: center; padding: 4px 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .warnings { border-left: 3px solid var(--vscode-editorWarning-foreground); padding-left: 10px; color: var(--vscode-editorWarning-foreground); }
    .files { max-height: 180px; overflow: auto; border: 1px solid var(--vscode-panel-border); padding: 8px; }
    .muted { color: var(--vscode-descriptionForeground); margin: 0; }
  </style>
</head>
<body>
  <main>
    ${data.message ? renderGeneratedView(data, pushTitle) : renderPreviewView(data)}
    ${warningHtml}
    <p id="error" role="alert" style="color: var(--vscode-errorForeground); display: none;"></p>
  </main>
  <script nonce="${options.nonce}">
    const vscode = acquireVsCodeApi();
    const message = document.getElementById("message");
    const errorEl = document.getElementById("error");
    function showError(text) {
      errorEl.textContent = text;
      errorEl.style.display = "block";
    }
    function selectedFiles() {
      return Array.from(document.querySelectorAll("input[name='file']:checked")).map((input) => input.value);
    }
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg && msg.command === "error") {
        showError(msg.text);
      }
    });
    document.getElementById("generate")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "generate", files: selectedFiles() });
    });
    document.getElementById("commit")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "commit", message: message.value });
    });
    document.getElementById("push")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "push", message: message?.value ?? "" });
    });
    document.getElementById("commitAndPush")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "commitAndPush", message: message.value });
    });
  </script>
</body>
</html>`;
}

function renderPreviewView(data: CommitAssistantData): string {
  const files = data.diffContext.files
    .map(
      (file) =>
        `<label class="file"><input type="checkbox" name="file" value="${escapeHtml(file)}" checked> ${escapeHtml(file)}</label>`
    )
    .join("");
  const excluded = data.diffContext.excludedFiles
    .map((file) => `<li>${escapeHtml(file.path)} - ${escapeHtml(file.reason)}</li>`)
    .join("");

  return `
    <h1>Review Changes</h1>
    ${renderStats(data)}
    <section class="files">
      <strong>Files to summarize</strong>
      ${files}
    </section>
    ${
      data.diffContext.excludedFiles.length > 0
        ? `<section class="files"><strong>Excluded files</strong><ul>${excluded}</ul></section>`
        : ""
    }
    <section class="actions">
      <button id="generate">Generate Message</button>
    </section>`;
}

function renderGeneratedView(data: CommitAssistantData, pushTitle: string): string {
  const message = data.message;
  if (!message) {
    return "";
  }

  const messageText = `${message.summary}\n\n${message.description}`.trim();
  const files = data.diffContext.files.map((file) => `<li>${escapeHtml(file)}</li>`).join("");

  return `
    <h1>CommitCraft Review</h1>
    <section>
      <label for="message">Commit message</label>
      <textarea id="message">${escapeHtml(messageText)}</textarea>
    </section>
    ${renderStats(data)}
    <section class="files">
      <strong>Affected files</strong>
      <ul>${files}</ul>
    </section>
    <section class="actions">
      <button id="commit">Commit</button>
      <button id="push" class="secondary" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Push</button>
      <button id="commitAndPush" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Commit and Push</button>
    </section>
    ${data.canPush ? "" : `<p class="muted">${escapeHtml(pushTitle)}</p>`}`;
}

function renderStats(data: CommitAssistantData): string {
  return `
    <section>
      <dl>
        ${data.modelUsed ? `<dt>Model</dt><dd>${escapeHtml(data.modelUsed)}</dd>` : ""}
        <dt>Diff source</dt><dd>${escapeHtml(data.diffContext.diffSource)}</dd>
        <dt>Files changed</dt><dd>${data.diffContext.stats.filesChanged}</dd>
        <dt>Lines added</dt><dd>${data.diffContext.stats.linesAdded}</dd>
        <dt>Lines removed</dt><dd>${data.diffContext.stats.linesRemoved}</dd>
        ${data.message ? `<dt>Risk</dt><dd>${escapeHtml(data.message.riskLevel)}</dd>` : ""}
      </dl>
    </section>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
