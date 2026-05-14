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
  activityHistory?: ActivityHistoryItem[];
}

export interface ActivityHistoryItem {
  type: "commit" | "push" | "undo";
  title: string;
  detail?: string;
  hash?: string;
}

export interface CommitAssistantRenderOptions {
  cspSource: string;
  nonce: string;
}

const CSS = `
  :root {
    --cc-added: #3fb950;
    --cc-removed: #f85149;
    --cc-warn: #e3b341;
    --cc-surface: var(--vscode-sideBar-background);
    --cc-surface-alt: var(--vscode-editor-background);
    --cc-border: var(--vscode-panel-border);
    --cc-muted: var(--vscode-descriptionForeground);
    --cc-fg: var(--vscode-foreground);
    --cc-accent: var(--vscode-focusBorder);
    --cc-r: 4px;
    --cc-r-lg: 8px;
  }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    color: var(--cc-fg);
    background: var(--cc-surface-alt);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    margin: 0;
    padding: 16px;
    line-height: 1.5;
  }
  main {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Status rail */
  .status-rail {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--cc-border);
  }
  .rail-title {
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 7px;
    margin-right: 2px;
  }
  .rail-title::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--cc-accent);
    display: inline-block;
    flex-shrink: 0;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--cc-border);
    color: var(--cc-muted);
    background: var(--cc-surface);
    white-space: nowrap;
  }
  .pill-added { color: var(--cc-added); border-color: rgba(63,185,80,0.3); background: rgba(63,185,80,0.07); }
  .pill-removed { color: var(--cc-removed); border-color: rgba(248,81,73,0.3); background: rgba(248,81,73,0.07); }
  .pill-warn { color: var(--cc-warn); border-color: rgba(227,179,65,0.3); background: rgba(227,179,65,0.07); }
  .pill-accent { color: var(--cc-accent); border-color: rgba(0,127,212,0.3); background: rgba(0,127,212,0.07); }

  /* Push banner */
  .push-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: var(--cc-r-lg);
    border: 1px solid rgba(0,127,212,0.3);
    background: rgba(0,127,212,0.06);
    font-size: 12px;
  }
  .push-banner-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--cc-accent);
    flex-shrink: 0;
  }

  /* Block */
  .block {
    background: var(--cc-surface);
    border: 1px solid var(--cc-border);
    border-radius: var(--cc-r-lg);
    overflow: hidden;
  }
  .block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid var(--cc-border);
  }
  .block-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--cc-muted);
  }
  .block-count {
    font-size: 11px;
    color: var(--cc-muted);
    font-family: var(--vscode-editor-font-family);
  }
  .block-body { padding: 12px 14px; }

  /* Stat strip */
  .stat-strip {
    display: flex;
    background: var(--cc-surface);
    border: 1px solid var(--cc-border);
    border-radius: var(--cc-r-lg);
    overflow: hidden;
  }
  .stat-item {
    flex: 1;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .stat-item + .stat-item { border-left: 1px solid var(--cc-border); }
  .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--cc-muted); }
  .stat-value { font-size: 18px; font-weight: 700; font-family: var(--vscode-editor-font-family); line-height: 1; }
  .stat-meta { font-size: 11px; color: var(--cc-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
  .stat-item.added .stat-value { color: var(--cc-added); }
  .stat-item.removed .stat-value { color: var(--cc-removed); }

  /* File list — selectable (preview view) */
  .file-list { display: flex; flex-direction: column; }
  label.file-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    cursor: pointer;
    border-bottom: 1px solid var(--cc-border);
    transition: background 0.1s;
  }
  label.file-row:last-child { border-bottom: 0; }
  label.file-row:hover { background: rgba(0,127,212,0.05); }
  .file-checkbox {
    width: 13px;
    height: 13px;
    margin: 0;
    flex-shrink: 0;
    accent-color: var(--cc-accent);
    cursor: pointer;
  }
  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
  }
  .file-open-btn {
    flex: 1;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    color: inherit;
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-radius: 2px;
    transition: color 0.1s;
  }
  .file-open-btn:hover { color: var(--vscode-textLink-activeForeground, var(--cc-accent)); text-decoration: underline; }
  .file-stat {
    flex-shrink: 0;
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: -0.02em;
    padding: 1px 5px;
    border-radius: 3px;
  }
  .file-stat.added { color: var(--cc-added); }
  .file-stat.removed { color: var(--cc-removed); }

  /* File list — read-only (generated view) */
  .file-row-plain {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--cc-border);
    color: var(--cc-muted);
  }
  .file-row-plain .file-open-btn { color: var(--cc-muted); }
  .file-row-plain .file-open-btn:hover { color: var(--vscode-textLink-activeForeground, var(--cc-accent)); }
  .file-row-plain:last-child { border-bottom: 0; }

  /* Excluded files */
  .excluded-list { padding: 8px 14px; display: flex; flex-direction: column; gap: 5px; }
  .excluded-item { display: flex; gap: 10px; align-items: baseline; font-size: 12px; }
  .excluded-path {
    font-family: var(--vscode-editor-font-family);
    color: var(--cc-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .excluded-reason { font-size: 11px; color: var(--cc-warn); white-space: nowrap; flex-shrink: 0; }

  /* Message block */
  .message-block {
    display: flex;
    flex-direction: column;
    background: var(--cc-surface);
    border: 1px solid var(--cc-border);
    border-radius: var(--cc-r-lg);
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .message-block:focus-within { border-color: var(--cc-accent); }
  .message-field-row { display: flex; flex-direction: column; }
  .message-field-row + .message-field-row { border-top: 1px solid var(--cc-border); }
  .field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px 3px;
  }
  .field-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--cc-muted);
    display: block;
  }
  .char-counter {
    font-size: 10px;
    color: var(--cc-muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    transition: color 0.15s;
  }
  .char-counter.summary-over { color: var(--cc-removed); font-weight: 600; }
  input#summary, textarea#description {
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--cc-fg);
    font-family: var(--vscode-editor-font-family);
    font-size: 13px;
    line-height: 1.5;
    padding: 4px 14px 10px;
    width: 100%;
  }
  textarea#description { min-height: 110px; resize: vertical; }

  /* Buttons */
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    padding: 7px 14px;
    border: 0;
    border-radius: var(--cc-r);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s, opacity 0.1s;
  }
  button:disabled { opacity: 0.38; cursor: not-allowed; pointer-events: none; }
  button.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font-weight: 600;
  }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  button.secondary:hover { filter: brightness(1.12); }
  button.push-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--cc-accent);
    font-weight: 600;
  }
  button.push-btn:hover { background: var(--vscode-button-hoverBackground); }
  button.generate-btn {
    width: 100%;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  button.generate-btn:hover { background: var(--vscode-button-hoverBackground); }
  .action-bar { display: flex; gap: 8px; flex-wrap: wrap; }

  /* Success block */
  .success-block {
    border-color: rgba(63,185,80,0.35);
    background: rgba(63,185,80,0.04);
  }
  .success-header { display: flex; align-items: flex-start; gap: 12px; padding: 14px; }
  .success-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid var(--cc-added);
    background: rgba(63,185,80,0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--cc-added);
    font-size: 13px;
  }
  .success-title { font-size: 14px; font-weight: 700; color: var(--cc-added); margin: 0 0 3px; }
  .success-subtitle { font-size: 12px; color: var(--cc-muted); margin: 0; line-height: 1.4; }
  .success-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 10px 14px;
    border-top: 1px solid rgba(63,185,80,0.2);
  }
  .success-summary {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--cc-muted);
  }
  .commit-hash {
    display: inline-flex;
    align-items: center;
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    padding: 2px 8px;
    border-radius: var(--cc-r);
    border: 1px solid var(--cc-border);
    color: var(--vscode-textCodeBlock-foreground, var(--cc-muted));
    background: var(--vscode-textCodeBlock-background, var(--cc-surface));
    flex-shrink: 0;
  }

  /* Timeline */
  .timeline { display: flex; flex-direction: column; }
  .timeline-item {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--cc-border);
  }
  .timeline-item:last-child { border-bottom: 0; }
  .timeline-node {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid var(--cc-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
    background: var(--cc-surface-alt);
  }
  .timeline-item.commit .timeline-node { border-color: var(--cc-added); color: var(--cc-added); background: rgba(63,185,80,0.08); }
  .timeline-item.push .timeline-node { border-color: var(--cc-accent); color: var(--cc-accent); background: rgba(0,127,212,0.08); }
  .timeline-item.undo .timeline-node { border-color: var(--cc-warn); color: var(--cc-warn); background: rgba(227,179,65,0.08); }
  .timeline-content { flex: 1; min-width: 0; }
  .timeline-title { font-size: 12px; font-weight: 600; line-height: 1.3; }
  .timeline-detail { font-size: 11px; color: var(--cc-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Warnings */
  .warnings {
    padding: 9px 12px;
    border-left: 2px solid var(--cc-warn);
    background: rgba(227,179,65,0.06);
    border-radius: 0 var(--cc-r) var(--cc-r) 0;
    font-size: 12px;
    color: var(--cc-warn);
  }
  .warnings p { margin: 0; line-height: 1.5; }
  .warnings p + p { margin-top: 4px; }

  .muted { color: var(--cc-muted); font-size: 12px; margin: 0; }
  #error {
    font-size: 12px;
    padding: 9px 12px;
    border-radius: var(--cc-r);
    color: var(--vscode-errorForeground);
    background: rgba(248,81,73,0.08);
    border: 1px solid rgba(248,81,73,0.25);
  }

  @keyframes slide-up {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  main > * { animation: slide-up 0.12s ease both; }
  main > *:nth-child(2) { animation-delay: 0.03s; }
  main > *:nth-child(3) { animation-delay: 0.06s; }
  main > *:nth-child(4) { animation-delay: 0.09s; }
  main > *:nth-child(5) { animation-delay: 0.12s; }

  @media (max-width: 420px) {
    .stat-strip { flex-direction: column; }
    .stat-item + .stat-item { border-left: 0; border-top: 1px solid var(--cc-border); }
  }
`;

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
      ? `<div class="warnings">${warnings.map((w) => `<p>${escapeHtml(w)}</p>`).join("")}</div>`
      : "";
  const pushTitle = !data.canPush
    ? (data.pushDisabledReason ?? "Push is unavailable for this repository state")
    : data.pendingPushCount
      ? "Push the current branch"
      : "No unpushed commits";
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
  <title>CommitCraft</title>
  <style>${CSS}</style>
</head>
<body>
  <main>
    ${data.commitState ? renderPostCommitView(data, pushTitle) : data.message ? renderGeneratedView(data, pushTitle) : renderPreviewView(data, pushTitle)}
    ${renderActivityHistory(data.activityHistory)}
    ${warningHtml}
    <p id="error" role="alert" style="display:none;"></p>
  </main>
  <script nonce="${options.nonce}">
    const vscode = acquireVsCodeApi();
    const summary = document.getElementById("summary");
    const description = document.getElementById("description");
    const errorEl = document.getElementById("error");
    const summaryCounter = document.getElementById("summary-counter");
    function updateSummaryCounter() {
      if (!summary || !summaryCounter) return;
      const len = summary.value.length;
      summaryCounter.textContent = len + " / 72";
      summaryCounter.classList.toggle("summary-over", len > 72);
    }
    summary?.addEventListener("input", updateSummaryCounter);
    updateSummaryCounter();
    function showError(text) {
      errorEl.textContent = text;
      errorEl.style.display = "block";
    }
    function selectedFiles() {
      return Array.from(document.querySelectorAll("input[name='file']:checked")).map((i) => i.value);
    }
    function commitMessageValue() {
      const s = summary?.value?.trim() ?? "";
      const d = description?.value?.trim() ?? "";
      return d ? s + "\\n\\n" + d : s;
    }
    window.addEventListener("message", (event) => {
      if (event.data?.command === "error") showError(event.data.text);
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
    document.querySelectorAll(".file-open-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const filePath = btn.getAttribute("data-path");
        if (filePath) vscode.postMessage({ command: "openFile", path: filePath });
      });
    });
  </script>
</body>
</html>`;
}

function renderPreviewView(data: CommitAssistantData, pushTitle: string): string {
  const hasSummarizableFiles = data.diffContext.files.length > 0;
  const sourceLabel = data.diffContext.diffSource === "staged" ? "staged" : "unstaged";

  const files = data.diffContext.files
    .map((file) => {
      const stat = data.diffContext.fileStats[file];
      const statsHtml = stat
        ? `<span class="file-stat added">+${stat.added}</span><span class="file-stat removed">-${stat.removed}</span>`
        : "";
      return `<label class="file-row"><input class="file-checkbox" type="checkbox" name="file" value="${escapeHtml(file)}" checked><button class="file-open-btn" data-path="${escapeHtml(file)}" title="Open ${escapeHtml(file)}" type="button">${escapeHtml(file)}</button>${statsHtml}</label>`;
    })
    .join("");

  const excluded = data.diffContext.excludedFiles
    .map(
      (file) =>
        `<div class="excluded-item"><span class="excluded-path" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span><span class="excluded-reason">${escapeHtml(file.reason)}</span></div>`
    )
    .join("");

  const pills = [
    renderPill(sourceLabel),
    hasSummarizableFiles
      ? renderPill(
          `${data.diffContext.files.length} file${data.diffContext.files.length !== 1 ? "s" : ""}`
        )
      : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    ${renderStatusRail("Review Changes", pills)}
    ${renderPendingPushPanel(data)}
    ${renderStatStrip(data)}
    <div class="block">
      <div class="block-header">
        <span class="block-title">Files to summarize</span>
        ${hasSummarizableFiles ? `<span class="block-count">${data.diffContext.files.length}</span>` : ""}
      </div>
      ${
        hasSummarizableFiles
          ? `<div class="file-list">${files}</div>
             <div class="block-body">
               ${data.pendingPushCount ? `<div class="action-bar" style="margin-bottom:8px"><button id="push" class="push-btn" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>&#8593; Push ${escapeHtml(formatPendingPushCount(data.pendingPushCount) ?? "")}</button><button id="undoCommit" class="secondary">&#8629; Undo Last Commit</button></div>${!data.canPush ? `<p class="muted">${escapeHtml(pushTitle)}</p>` : ""}` : ""}
               <button id="generate" class="generate-btn">Generate Message &#8594;</button>
             </div>`
          : `<div class="block-body"><p class="muted">No safe text files are available to summarize.</p></div>`
      }
    </div>
    ${
      data.diffContext.excludedFiles.length > 0
        ? `<div class="block">
             <div class="block-header">
               <span class="block-title">Excluded files</span>
               <span class="block-count">${data.diffContext.excludedFiles.length}</span>
             </div>
             <div class="excluded-list">${excluded}</div>
           </div>`
        : ""
    }`;
}

function renderGeneratedView(data: CommitAssistantData, pushTitle: string): string {
  const message = data.message;
  if (!message) {
    return "";
  }

  const files = data.diffContext.files
    .map((file) => {
      const stat = data.diffContext.fileStats[file];
      const statsHtml = stat
        ? `<span class="file-stat added">+${stat.added}</span><span class="file-stat removed">-${stat.removed}</span>`
        : "";
      return `<div class="file-row-plain"><button class="file-open-btn" data-path="${escapeHtml(file)}" title="Open ${escapeHtml(file)}" type="button">${escapeHtml(file)}</button>${statsHtml}</div>`;
    })
    .join("");

  const commitType = extractCommitType(message.summary);
  const riskClass =
    message.riskLevel === "high"
      ? "pill-removed"
      : message.riskLevel === "medium"
        ? "pill-warn"
        : "pill-added";

  const pills = [
    commitType ? renderPill(commitType, "pill-accent") : "",
    renderPill(`risk: ${message.riskLevel}`, riskClass),
    data.modelUsed ? renderPill(shortenModelName(data.modelUsed)) : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    ${renderStatusRail("CommitCraft Review", pills)}
    ${renderPendingPushPanel(data)}
    <div class="message-block">
      <div class="message-field-row">
        <div class="field-label-row">
          <label class="field-label" for="summary">Summary</label>
          <span id="summary-counter" class="char-counter">${escapeHtml(String(message.summary.length))} / 72</span>
        </div>
        <input id="summary" value="${escapeHtml(message.summary)}" spellcheck="true">
      </div>
      <div class="message-field-row">
        <label class="field-label" for="description" style="padding:9px 14px 3px;">Description</label>
        <textarea id="description" spellcheck="true">${escapeHtml(message.description)}</textarea>
      </div>
    </div>
    ${renderStatStrip(data)}
    <div class="block">
      <div class="block-header">
        <span class="block-title">Affected files</span>
        <span class="block-count">${data.diffContext.files.length}</span>
      </div>
      <div class="file-list">${files}</div>
    </div>
    <div class="action-bar">
      <button id="commit" class="primary">Commit</button>
      <button id="push" class="push-btn" title="${escapeHtml(pushTitle)}" ${data.canPush && data.pendingPushCount ? "" : "disabled"}>&#8593; Push</button>
      <button id="commitAndPush" class="secondary" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Commit + Push</button>
    </div>
    ${!data.canPush ? `<p class="muted">${escapeHtml(pushTitle)}</p>` : ""}`;
}

function renderPostCommitView(data: CommitAssistantData, pushTitle: string): string {
  const state = data.commitState;
  if (!state) {
    return "";
  }

  const isPushed = state.status === "pushed";
  const isPendingPush = state.status === "pendingPush";
  const title = isPushed ? "Pushed" : isPendingPush ? "Ready to Push" : "Committed";
  const subtitle = isPushed
    ? "Branch was pushed to the remote."
    : isPendingPush
      ? "This branch has local commits that haven't been pushed."
      : "Local commit created. Push it, keep committing, or undo to revise.";
  const icon = isPushed ? "&#8593;" : isPendingPush ? "&#9679;" : "&#10003;";
  const pendingLabel = formatPendingPushCount(data.pendingPushCount);

  const pills = [state.commitHash ? renderPill(state.commitHash) : ""].filter(Boolean).join("");

  return `
    ${renderStatusRail(title, pills)}
    <div class="block success-block">
      <div class="success-header">
        <div class="success-icon">${icon}</div>
        <div>
          <p class="success-title">${escapeHtml(title)}</p>
          <p class="success-subtitle">${escapeHtml(subtitle)}</p>
        </div>
      </div>
      ${
        state.commitHash || pendingLabel || data.message
          ? `<div class="success-footer">
               ${state.commitHash ? `<span class="commit-hash">${escapeHtml(state.commitHash)}</span>` : ""}
               ${pendingLabel ? `<span class="muted">${escapeHtml(pendingLabel)} unpushed</span>` : ""}
               ${data.message ? `<span class="success-summary">${escapeHtml(data.message.summary)}</span>` : ""}
             </div>`
          : ""
      }
    </div>
    ${
      !isPushed
        ? `<div class="action-bar">
             <button id="push" class="push-btn" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>&#8593; Push</button>
             <button id="undoCommit" class="secondary">&#8629; ${isPendingPush ? "Undo Last Commit" : "Undo Commit"}</button>
             ${data.canReviewChanges ? `<button id="reviewChanges" class="secondary">Review Remaining Changes</button>` : ""}
           </div>
           ${!data.canPush ? `<p class="muted">${escapeHtml(pushTitle)}</p>` : ""}`
        : data.canReviewChanges
          ? `<div class="action-bar"><button id="reviewChanges" class="secondary">Review Remaining Changes</button></div>`
          : ""
    }`;
}

function renderActivityHistory(items: ActivityHistoryItem[] | undefined): string {
  if (!items || items.length === 0) {
    return "";
  }

  const nodeIcon: Record<ActivityHistoryItem["type"], string> = {
    commit: "&#10003;",
    push: "&#8593;",
    undo: "&#8629;"
  };

  const rows = items
    .map(
      (item) => `
        <div class="timeline-item ${escapeHtml(item.type)}">
          <div class="timeline-node">${nodeIcon[item.type]}</div>
          <div class="timeline-content">
            <div class="timeline-title">${escapeHtml(item.title)}</div>
            ${item.detail ? `<div class="timeline-detail" title="${escapeHtml(item.detail)}">${escapeHtml(item.detail)}</div>` : ""}
          </div>
          ${item.hash ? `<span class="commit-hash">${escapeHtml(item.hash)}</span>` : ""}
        </div>`
    )
    .join("");

  return `<div class="block">
    <div class="block-header">
      <span class="block-title">History</span>
      <span class="block-count">${items.length}</span>
    </div>
    <div class="timeline">${rows}</div>
  </div>`;
}

function renderPendingPushPanel(data: CommitAssistantData): string {
  const label = formatPendingPushCount(data.pendingPushCount);
  if (!label || data.commitState) {
    return "";
  }

  return `<div class="push-banner">
    <div class="push-banner-dot"></div>
    <span>${escapeHtml(label)} ready to push</span>
  </div>`;
}

function renderStatusRail(title: string, pills: string): string {
  return `<div class="status-rail">
    <span class="rail-title">${escapeHtml(title)}</span>
    ${pills}
  </div>`;
}

function renderPill(text: string, cls = ""): string {
  return `<span class="pill ${escapeHtml(cls)}">${escapeHtml(text)}</span>`;
}

function renderStatStrip(data: CommitAssistantData): string {
  const stats = data.diffContext.stats;
  const diffSource = data.diffContext.diffSource;
  return `<div class="stat-strip" aria-label="Git change statistics">
    <div class="stat-item">
      <div class="stat-label">Files</div>
      <div class="stat-value">${stats.filesChanged}</div>
      <div class="stat-meta">${escapeHtml(diffSource)}</div>
    </div>
    <div class="stat-item added">
      <div class="stat-label">Added</div>
      <div class="stat-value">+${stats.linesAdded}</div>
    </div>
    <div class="stat-item removed">
      <div class="stat-label">Removed</div>
      <div class="stat-value">-${stats.linesRemoved}</div>
    </div>
  </div>`;
}

function formatPendingPushCount(count: number | undefined): string | undefined {
  if (!count || count < 1) {
    return undefined;
  }

  return count === 1 ? "1 unpushed commit" : `${count} unpushed commits`;
}

function extractCommitType(summary: string): string | undefined {
  const match = summary.match(/^([a-z]+)(\([^)]+\))?!?:/i);
  return match ? match[1].toLowerCase() : undefined;
}

function shortenModelName(model: string): string {
  const parts = model.split("/");
  return parts[parts.length - 1] ?? model;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
