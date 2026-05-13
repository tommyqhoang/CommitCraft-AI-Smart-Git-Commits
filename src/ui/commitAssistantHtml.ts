import type { DiffContext } from "../git/diffCollector";
import type { GeneratedCommitMessage } from "../openrouter/responseParser";

export type CommitState =
  | {
      status: "committed";
      commitHash?: string;
    }
  | {
      status: "pendingPush";
      commitHash?: string;
    }
  | {
      status: "pushed";
      commitHash?: string;
    };

export interface CommitAssistantData {
  message?: GeneratedCommitMessage;
  modelUsed?: string;
  diffContext: DiffContext;
  recovered: boolean;
  recoveryReason?: string;
  canPush: boolean;
  pushDisabledReason?: string;
  commitState?: CommitState;
  pendingPushCount?: number;
  canReviewChanges?: boolean;
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
    :root {
      --commitcraft-added: #3fb950;
      --commitcraft-removed: #f85149;
      --commitcraft-panel: var(--vscode-sideBar-background);
      --commitcraft-border: var(--vscode-panel-border);
    }
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); margin: 0; padding: 20px; }
    main { max-width: 980px; margin: 0 auto; display: grid; gap: 16px; }
    h1 { font-size: 22px; line-height: 1.2; margin: 0; }
    input, textarea { width: 100%; box-sizing: border-box; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); padding: 12px; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); line-height: 1.45; border-radius: 4px; }
    input { min-height: 40px; }
    textarea { min-height: 190px; resize: vertical; }
    .message-fields { display: grid; gap: 12px; }
    .field-label { display: block; margin-bottom: 6px; color: var(--vscode-descriptionForeground); }
    .description-box { max-height: 260px; overflow: auto; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 4px; padding: 8px 12px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    ul { margin-top: 8px; padding-left: 20px; }
    label.file { display: flex; gap: 8px; align-items: center; padding: 5px 0; }
    .assistant-shell { display: grid; gap: 16px; }
    .hero { display: grid; gap: 4px; border-bottom: 1px solid var(--commitcraft-border); padding-bottom: 12px; }
    .subtitle { color: var(--vscode-descriptionForeground); margin: 0; }
    .panel { background: var(--commitcraft-panel); border: 1px solid var(--commitcraft-border); border-radius: 6px; padding: 14px; }
    .section-title { display: block; margin-bottom: 8px; font-size: 12px; letter-spacing: 0; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
    .stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .stat-card { border: 1px solid var(--commitcraft-border); border-radius: 6px; padding: 12px; background: var(--vscode-editor-background); min-width: 0; }
    .stat-label { color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 6px; }
    .stat-value { font-size: 24px; font-weight: 700; line-height: 1; }
    .stat-added .stat-value { color: var(--commitcraft-added); }
    .stat-removed .stat-value { color: var(--commitcraft-removed); }
    .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .meta-item { min-width: 0; }
    .meta-label { color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 3px; }
    .meta-value { overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .action-bar { align-items: center; border-top: 1px solid var(--commitcraft-border); padding-top: 12px; }
    .primary-action { font-weight: 600; }
    .success-panel { display: grid; gap: 10px; border-color: var(--commitcraft-added); }
    .success-title { color: var(--commitcraft-added); font-size: 18px; font-weight: 700; margin: 0; }
    .commit-hash { display: inline-block; width: fit-content; font-family: var(--vscode-editor-font-family); color: var(--vscode-textCodeBlock-foreground); background: var(--vscode-textCodeBlock-background); border: 1px solid var(--commitcraft-border); border-radius: 4px; padding: 4px 6px; }
    .warnings { border-left: 3px solid var(--vscode-editorWarning-foreground); padding-left: 10px; color: var(--vscode-editorWarning-foreground); }
    .files { max-height: 210px; overflow: auto; }
    .muted { color: var(--vscode-descriptionForeground); margin: 0; }
    @media (max-width: 640px) {
      .stat-grid, .meta-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    ${data.commitState ? renderPostCommitView(data, pushTitle) : data.message ? renderGeneratedView(data, pushTitle) : renderPreviewView(data)}
    ${warningHtml}
    <p id="error" role="alert" style="color: var(--vscode-errorForeground); display: none;"></p>
  </main>
  <script nonce="${options.nonce}">
    const vscode = acquireVsCodeApi();
    const summary = document.getElementById("summary");
    const description = document.getElementById("description");
    const errorEl = document.getElementById("error");
    function showError(text) {
      errorEl.textContent = text;
      errorEl.style.display = "block";
    }
    function selectedFiles() {
      return Array.from(document.querySelectorAll("input[name='file']:checked")).map((input) => input.value);
    }
    function commitMessageValue() {
      const summaryText = summary?.value?.trim() ?? "";
      const descriptionText = description?.value?.trim() ?? "";
      return descriptionText ? summaryText + "\\n\\n" + descriptionText : summaryText;
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
      vscode.postMessage({ command: "commit", message: commitMessageValue() });
    });
    document.getElementById("push")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "push", message: commitMessageValue() });
    });
    document.getElementById("commitAndPush")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "commitAndPush", message: commitMessageValue() });
    });
    document.getElementById("undoCommit")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "undoCommit" });
    });
    document.getElementById("reviewChanges")?.addEventListener("click", () => {
      errorEl.style.display = "none";
      vscode.postMessage({ command: "reviewChanges" });
    });
  </script>
</body>
</html>`;
}

function renderPreviewView(data: CommitAssistantData): string {
  const hasSummarizableFiles = data.diffContext.files.length > 0;
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
    <section class="assistant-shell">
    ${renderHeader("Review Changes", "Select the safe files CommitCraft should summarize before anything is sent to OpenRouter.")}
    ${renderPendingPushPanel(data)}
    ${renderStats(data)}
    <section class="panel files">
      <strong class="section-title">Files to summarize</strong>
      ${hasSummarizableFiles ? `<div>${files}</div>` : `<p class="muted">No safe text files are available to summarize.</p>`}
    </section>
    ${
      data.diffContext.excludedFiles.length > 0
        ? `<section class="panel files"><strong class="section-title">Excluded files</strong><ul>${excluded}</ul></section>`
        : ""
    }
    ${
      hasSummarizableFiles
        ? `<section class="actions action-bar">${data.pendingPushCount ? `<button id="push" class="secondary">Push Pending Commits</button>` : ""}<button id="generate" class="primary-action">Generate Message</button></section>`
        : ""
    }
    </section>`;
}

function renderGeneratedView(data: CommitAssistantData, pushTitle: string): string {
  const message = data.message;
  if (!message) {
    return "";
  }

  const files = data.diffContext.files.map((file) => `<li>${escapeHtml(file)}</li>`).join("");

  return `
    <section class="assistant-shell">
    ${renderHeader("CommitCraft Review", "Review the generated message, make edits, then choose the Git action to run.")}
    ${renderPendingPushPanel(data)}
    <section class="panel message-fields">
      <div>
        <label class="field-label" for="summary">Commit message</label>
        <input id="summary" value="${escapeHtml(message.summary)}">
      </div>
      <div>
        <label class="field-label" for="description">Description</label>
        <textarea id="description" class="description-box">${escapeHtml(message.description)}</textarea>
      </div>
    </section>
    ${renderStats(data)}
    <section class="panel files">
      <strong class="section-title">Affected files</strong>
      <ul>${files}</ul>
    </section>
    <section class="actions action-bar">
      <button id="commit" class="primary-action">Commit</button>
      <button id="push" class="secondary" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Push</button>
      <button id="commitAndPush" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Commit and Push</button>
    </section>
    ${data.canPush ? "" : `<p class="muted">${escapeHtml(pushTitle)}</p>`}
    </section>`;
}

function renderPendingPushPanel(data: CommitAssistantData): string {
  const pendingPushLabel = formatPendingPushCount(data.pendingPushCount);
  if (!pendingPushLabel || data.commitState) {
    return "";
  }

  return `<section class="panel"><strong class="section-title">Pending push</strong><p class="muted">${escapeHtml(pendingPushLabel)} ready to push.</p></section>`;
}

function renderPostCommitView(data: CommitAssistantData, pushTitle: string): string {
  const state = data.commitState;
  if (!state) {
    return "";
  }

  const isPushed = state.status === "pushed";
  const isPendingPush = state.status === "pendingPush";
  const title = isPushed
    ? "Push successful"
    : isPendingPush
      ? "Ready to push"
      : "Commit successful";
  const pendingPushLabel = formatPendingPushCount(data.pendingPushCount);
  const subtitle = isPushed
    ? "Your commit was pushed to the configured remote."
    : isPendingPush
      ? "This branch already has local commits that have not been pushed."
      : "Your local commit was created. Push it now, keep committing, or undo the local commit before pushing.";

  return `
    <section class="assistant-shell">
    ${renderHeader(title, subtitle)}
    <section class="panel success-panel">
      <p class="success-title">${escapeHtml(title)}</p>
      ${state.commitHash ? `<span class="commit-hash">${escapeHtml(state.commitHash)}</span>` : ""}
      ${pendingPushLabel ? `<p class="muted">${escapeHtml(pendingPushLabel)}</p>` : ""}
      ${data.message ? `<p class="muted">${escapeHtml(data.message.summary)}</p>` : ""}
    </section>
    <section class="actions action-bar">
      ${
        isPushed
          ? ""
          : `<button id="push" class="primary-action" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Push</button>
      <button id="undoCommit" class="secondary">${isPendingPush ? "Undo Last Commit" : "Undo Commit"}</button>`
      }
      ${data.canReviewChanges ? `<button id="reviewChanges" class="secondary">Review Remaining Changes</button>` : ""}
    </section>
    ${!isPushed && !data.canPush ? `<p class="muted">${escapeHtml(pushTitle)}</p>` : ""}
    </section>`;
}

function formatPendingPushCount(count: number | undefined): string | undefined {
  if (!count || count < 1) {
    return undefined;
  }

  return count === 1 ? "1 unpushed commit" : `${count} unpushed commits`;
}

function renderStats(data: CommitAssistantData): string {
  const stats = data.diffContext.stats;
  return `
    <section class="panel">
      <div class="stat-grid" aria-label="Git change statistics">
        <div class="stat-card stat-files"><div class="stat-label">Files changed</div><div class="stat-value">${stats.filesChanged}</div></div>
        <div class="stat-card stat-added"><div class="stat-label">Lines added</div><div class="stat-value">+${stats.linesAdded}</div></div>
        <div class="stat-card stat-removed"><div class="stat-label">Lines removed</div><div class="stat-value">-${stats.linesRemoved}</div></div>
      </div>
      <div class="meta-grid" style="margin-top: 12px;">
        ${renderMetaItem("Diff source", data.diffContext.diffSource)}
        ${data.modelUsed ? renderMetaItem("Model", data.modelUsed) : ""}
        ${data.message ? renderMetaItem("Risk", data.message.riskLevel) : ""}
      </div>
    </section>`;
}

function renderHeader(title: string, subtitle: string): string {
  return `<header class="hero"><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></header>`;
}

function renderMetaItem(label: string, value: string): string {
  return `<div class="meta-item"><div class="meta-label">${escapeHtml(label)}</div><div class="meta-value">${escapeHtml(value)}</div></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
