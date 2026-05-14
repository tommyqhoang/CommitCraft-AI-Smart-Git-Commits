# DX Features + 95% Coverage + CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four senior-dev DX features (skip-confirmation, char counter, copy button, regenerate), bring test coverage to ≥95%, and add a GitHub Actions workflow that posts pass/fail to Slack on every push.

**Architecture:** All four features are additive changes to existing files — no new source modules needed. Coverage gaps are filled by expanding the existing test files. The CI workflow is a new file at `.github/workflows/test.yml` that installs deps, compiles, lints, runs `test:coverage`, and posts a Slack message via webhook.

**Tech Stack:** TypeScript, VS Code extension API, Vitest + @vitest/coverage-v8, GitHub Actions, Slack Incoming Webhooks

---

## File Map

| File                                     | Change                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/settings.ts`                 | Add `skipCommitConfirmation: boolean` to interface + reader                                                                           |
| `package.json`                           | Add `commitCraft.skipCommitConfirmation` to `contributes.configuration`; add `@vitest/coverage-v8` devDep; add `test:coverage` script |
| `vitest.config.ts`                       | Add `coverage.thresholds` at 95%; add `include` for src files                                                                         |
| `src/commands/generateCommitMessage.ts`  | Use `skipCommitConfirmation`; add `regenerate` callback                                                                               |
| `src/ui/commitReviewPanel.ts`            | Add `regenerate` to `CommitReviewHandlers`; handle `"regenerate"` message                                                             |
| `src/ui/commitAssistantHtml.ts`          | Char counter CSS+HTML+JS; Copy button HTML+JS; Regenerate button HTML+JS                                                              |
| `src/test/settings.test.ts`              | `skipCommitConfirmation` default + override cases                                                                                     |
| `src/test/commitReviewPanel.test.ts`     | New cases: char counter, copy btn, regenerate btn, all HTML branches                                                                  |
| `src/test/generateCommitMessage.test.ts` | New cases: skip confirmation, regenerate, classifyNetworkError paths                                                                  |
| `src/test/notifications.test.ts`         | Full coverage of `notifications.ts` (new file)                                                                                        |
| `.github/workflows/test.yml`             | CI: install → compile → lint → test:coverage → Slack notify                                                                           |

---

## Task 1: `skipCommitConfirmation` setting

**Files:**

- Modify: `src/config/settings.ts`
- Modify: `package.json`
- Modify: `src/commands/generateCommitMessage.ts`
- Modify: `src/test/settings.test.ts`
- Modify: `src/test/generateCommitMessage.test.ts`

- [ ] **Step 1.1: Write failing tests for the new setting**

Add to `src/test/settings.test.ts`:

```typescript
it("skipCommitConfirmation defaults to false", () => {
  const config: ConfigReader = { get: vi.fn().mockReturnValue(undefined) };
  const settings = readSettingsFromConfig(config);
  expect(settings.skipCommitConfirmation).toBe(false);
});

it("skipCommitConfirmation reads true from config", () => {
  const config: ConfigReader = {
    get: vi.fn((key) => (key === "skipCommitConfirmation" ? true : undefined))
  };
  const settings = readSettingsFromConfig(config);
  expect(settings.skipCommitConfirmation).toBe(true);
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 3 "skipCommitConfirmation"
```

Expected: FAIL — `settings.skipCommitConfirmation` is `undefined`, not `false`.

- [ ] **Step 1.3: Add `skipCommitConfirmation` to settings**

Replace the interface and reader in `src/config/settings.ts`:

```typescript
export interface AiCommitSettings {
  openRouterModel: string;
  fallbackModel: string;
  maxDiffCharacters: number;
  includeUntrackedFiles: boolean;
  skipCommitConfirmation: boolean;
}

export interface ConfigReader {
  get<T>(key: string): T | undefined;
}

export const openRouterTokenSecretKey = "commitCraft.openRouterToken";

export function readSettingsFromConfig(config: ConfigReader): AiCommitSettings {
  return {
    openRouterModel: readNonEmptyString(config, "openRouterModel", "openrouter/auto"),
    fallbackModel: readNonEmptyString(config, "fallbackModel", "openrouter/free"),
    maxDiffCharacters: readDiffLimit(config),
    includeUntrackedFiles: config.get<boolean>("includeUntrackedFiles") ?? true,
    skipCommitConfirmation: config.get<boolean>("skipCommitConfirmation") ?? false
  };
}

function readNonEmptyString(config: ConfigReader, key: string, fallback: string): string {
  const value = config.get<string>(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readDiffLimit(config: ConfigReader): number {
  const value = config.get<number>("maxDiffCharacters");
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(200_000, Math.max(1000, value))
    : 60_000;
}
```

- [ ] **Step 1.4: Add `skipCommitConfirmation` to `package.json` contributes**

Inside `contributes.configuration.properties`, add after `includeUntrackedFiles`:

```json
"commitCraft.skipCommitConfirmation": {
  "type": "boolean",
  "default": false,
  "description": "Skip the confirmation dialog when committing. The panel itself serves as review."
}
```

- [ ] **Step 1.5: Write failing test for skip-confirmation behaviour in generateCommitMessage**

Add to `src/test/generateCommitMessage.test.ts` in the `commit` describe block:

```typescript
it("commits without showing a confirmation modal when skipCommitConfirmation is true", async () => {
  vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
  vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
  vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
  vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);
  vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
    get: vi.fn((key: string) => (key === "skipCommitConfirmation" ? true : undefined))
  } as unknown as vscode.WorkspaceConfiguration);

  const gitService = makeGitService();
  await generateCommitMessage(makeContext(), {
    gitService,
    openRouterClient: makeOpenRouterClient()
  });

  const handlers = getCapturedHandlers();
  await handlers.commit("fix: something");

  // showWarningMessage (confirmation modal) must NOT have been called
  expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  expect(gitService.commit).toHaveBeenCalledWith(
    expect.objectContaining({ message: "fix: something" })
  );
});
```

- [ ] **Step 1.6: Use `skipCommitConfirmation` in `commitReviewedMessage`**

In `src/commands/generateCommitMessage.ts`, update `getAiCommitSettings()` call site and pass `skipCommitConfirmation` into `commitReviewedMessage`. Change the function signature:

```typescript
async function commitReviewedMessage(
  gitService: GitService,
  workspacePath: string,
  message: string,
  files: string[],
  hasStagedChanges: boolean,
  skipConfirmation: boolean
): Promise<boolean> {
  const normalized = message.trim();
  if (normalized.length === 0) {
    throw new UserInputError("Commit message cannot be empty.");
  }

  if (!skipConfirmation) {
    const action = hasStagedChanges ? "Commit Staged Changes" : "Stage and Commit";
    const prompt = hasStagedChanges
      ? "Commit the currently staged changes with this message?"
      : "Stage the reviewed safe files and commit them with this message?";
    if (!(await confirmAction(prompt, action))) {
      return false;
    }
  }

  await gitService.commit({
    workspacePath,
    message: normalized,
    filesToStage: files,
    stageFilesBeforeCommit: !hasStagedChanges
  });
  await showInfo("Commit created.");
  return true;
}
```

Update the two call sites in the `commit` and `commitAndPush` handlers inside `generateCommitMessage`:

```typescript
// In commit handler:
const committed = await commitReviewedMessage(
  gitService,
  workspacePath,
  message,
  getGeneratedFiles(generatedDiffContext),
  currentHasStagedChanges,
  settings.skipCommitConfirmation
);

// In commitAndPush handler:
const committed = await commitReviewedMessage(
  gitService,
  workspacePath,
  message,
  getGeneratedFiles(generatedDiffContext),
  currentHasStagedChanges,
  settings.skipCommitConfirmation
);
```

Also update `vi.mock("../config/vscodeSettings"...)` in `generateCommitMessage.test.ts` to include `skipCommitConfirmation: false` in the default mock so existing tests pass.

- [ ] **Step 1.7: Run tests and verify all pass**

```bash
npm test
```

Expected: all tests pass (107+).

- [ ] **Step 1.8: Commit**

```bash
git add src/config/settings.ts package.json src/commands/generateCommitMessage.ts src/test/settings.test.ts src/test/generateCommitMessage.test.ts
git commit -m "feat: add skipCommitConfirmation setting to skip modal on commit"
```

---

## Task 2: Summary character counter

**Files:**

- Modify: `src/ui/commitAssistantHtml.ts`
- Modify: `src/test/commitReviewPanel.test.ts`

- [ ] **Step 2.1: Write failing tests**

Add to `src/test/commitReviewPanel.test.ts`:

```typescript
it("renders a character counter next to the summary label in the generated view", () => {
  const html = renderCommitAssistantHtml(
    {
      ...baseData,
      message: { summary: "fix: something", description: "desc", riskLevel: "low" }
    },
    { cspSource: "vscode-resource:", nonce: "test-nonce" }
  );

  expect(html).toContain('id="summary-counter"');
  expect(html).toContain("/ 72");
});

it("includes JS that updates the counter on input", () => {
  const html = renderCommitAssistantHtml(
    {
      ...baseData,
      message: { summary: "feat: new", description: "", riskLevel: "low" }
    },
    { cspSource: "vscode-resource:", nonce: "test-nonce" }
  );

  expect(html).toContain("summary-counter");
  expect(html).toContain("summary-over");
});
```

- [ ] **Step 2.2: Run to verify fails**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 3 "character counter"
```

Expected: FAIL — `summary-counter` not found in HTML.

- [ ] **Step 2.3: Add CSS for character counter**

In `src/ui/commitAssistantHtml.ts`, inside the `CSS` string, add after the `.muted` rule:

```css
.char-counter {
  font-size: 11px;
  color: var(--cc-muted);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.char-counter.summary-over {
  color: var(--cc-removed);
  font-weight: 600;
}
```

- [ ] **Step 2.4: Add counter HTML in `renderGeneratedView`**

In `src/ui/commitAssistantHtml.ts`, in `renderGeneratedView`, change the summary label row:

```typescript
      <div class="message-field-row">
        <label class="field-label" for="summary">Summary</label>
        <span id="summary-counter" class="char-counter">${escapeHtml(message.summary.length.toString())} / 72</span>
        <input id="summary" value="${escapeHtml(message.summary)}" spellcheck="true">
      </div>
```

- [ ] **Step 2.5: Add counter JS in the `<script>` block**

In `src/ui/commitAssistantHtml.ts`, in the script section, after `const summary = document.getElementById("summary");`, add:

```javascript
const summaryCounter = document.getElementById("summary-counter");
function updateSummaryCounter() {
  if (!summary || !summaryCounter) return;
  const len = summary.value.length;
  summaryCounter.textContent = len + " / 72";
  summaryCounter.classList.toggle("summary-over", len > 72);
}
summary?.addEventListener("input", updateSummaryCounter);
updateSummaryCounter();
```

- [ ] **Step 2.6: Also update `.message-field-row` CSS to use flex so label + counter + input stack properly**

In the CSS string, change the `.message-field-row` rule to:

```css
.message-field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.message-field-row:first-child {
  position: relative;
}
.message-field-row .field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

Actually, a simpler approach — wrap `<label>` and counter in a flex row. Change the summary field row to:

```typescript
      <div class="message-field-row">
        <div class="field-label-row">
          <label class="field-label" for="summary">Summary</label>
          <span id="summary-counter" class="char-counter">${escapeHtml(message.summary.length.toString())} / 72</span>
        </div>
        <input id="summary" value="${escapeHtml(message.summary)}" spellcheck="true">
      </div>
```

Add CSS:

```css
.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
```

- [ ] **Step 2.7: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 2.8: Commit**

```bash
git add src/ui/commitAssistantHtml.ts src/test/commitReviewPanel.test.ts
git commit -m "feat: live character counter on commit summary field (72-char limit)"
```

---

## Task 3: Copy message button

**Files:**

- Modify: `src/ui/commitAssistantHtml.ts`
- Modify: `src/test/commitReviewPanel.test.ts`

- [ ] **Step 3.1: Write failing tests**

Add to `src/test/commitReviewPanel.test.ts`:

```typescript
it("renders a copy button in the generated (edit) view", () => {
  const html = renderCommitAssistantHtml(
    {
      ...baseData,
      message: { summary: "fix: something", description: "desc", riskLevel: "low" }
    },
    { cspSource: "vscode-resource:", nonce: "test-nonce" }
  );

  expect(html).toContain('id="copyMessage"');
});

it("renders a copy button in the post-commit view", () => {
  const html = renderCommitAssistantHtml(
    {
      ...baseData,
      message: { summary: "fix: something", description: "desc", riskLevel: "low" },
      commitState: { status: "committed", commitHash: "abc1234" }
    },
    { cspSource: "vscode-resource:", nonce: "test-nonce" }
  );

  expect(html).toContain('id="copyMessage"');
});
```

- [ ] **Step 3.2: Run to verify fails**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 3 "copy button"
```

Expected: FAIL.

- [ ] **Step 3.3: Add copy button CSS**

In the `CSS` string, add:

```css
button.copy-btn {
  background: transparent;
  border: 1px solid var(--cc-border);
  color: var(--cc-muted);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: var(--cc-r);
  cursor: pointer;
  transition:
    color 0.1s,
    border-color 0.1s;
}
button.copy-btn:hover {
  color: var(--cc-fg);
  border-color: var(--vscode-focusBorder);
}
button.copy-btn.copied {
  color: var(--cc-added);
  border-color: var(--cc-added);
}
```

- [ ] **Step 3.4: Add copy button to `renderGeneratedView` action bar**

In `src/ui/commitAssistantHtml.ts`, in `renderGeneratedView`, change the action bar:

```typescript
    <div class="action-bar">
      <button id="commit" class="primary">Commit</button>
      <button id="push" class="push-btn" title="${escapeHtml(pushTitle)}" ${data.canPush && data.pendingPushCount ? "" : "disabled"}>&#8593; Push</button>
      <button id="commitAndPush" class="secondary" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Commit + Push</button>
      <button id="copyMessage" class="copy-btn" title="Copy commit message to clipboard">&#10697; Copy</button>
    </div>
```

- [ ] **Step 3.5: Add copy button to `renderPostCommitView` action bars**

In `renderPostCommitView`, both the `!isPushed` branch and the `isPushed` branch need the copy button. For the `!isPushed` branch:

```typescript
!isPushed
  ? `<div class="action-bar">
             <button id="push" class="push-btn" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>&#8593; Push</button>
             <button id="undoCommit" class="secondary">&#8629; ${isPendingPush ? "Undo Last Commit" : "Undo Commit"}</button>
             ${data.canReviewChanges ? `<button id="reviewChanges" class="secondary">Review Remaining Changes</button>` : ""}
             <button id="copyMessage" class="copy-btn" title="Copy commit message to clipboard">&#10697; Copy</button>
           </div>
           ${!data.canPush ? `<p class="muted">${escapeHtml(pushTitle)}</p>` : ""}`
  : data.canReviewChanges
    ? `<div class="action-bar"><button id="reviewChanges" class="secondary">Review Remaining Changes</button><button id="copyMessage" class="copy-btn" title="Copy commit message to clipboard">&#10697; Copy</button></div>`
    : `<div class="action-bar"><button id="copyMessage" class="copy-btn" title="Copy commit message to clipboard">&#10697; Copy</button></div>`;
```

- [ ] **Step 3.6: Add copy JS handler in script block**

In the script section, add after the `reviewChanges` event listener:

```javascript
document.getElementById("copyMessage")?.addEventListener("click", () => {
  const text = commitMessageValue();
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const btn = document.getElementById("copyMessage");
      if (btn) {
        btn.textContent = "✓ Copied";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "ၩ7 Copy";
          btn.classList.remove("copied");
        }, 1500);
      }
    })
    .catch(() => {});
});
```

- [ ] **Step 3.7: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 3.8: Commit**

```bash
git add src/ui/commitAssistantHtml.ts src/test/commitReviewPanel.test.ts
git commit -m "feat: copy commit message button in edit and post-commit views"
```

---

## Task 4: Regenerate button

**Files:**

- Modify: `src/ui/commitReviewPanel.ts`
- Modify: `src/ui/commitAssistantHtml.ts`
- Modify: `src/commands/generateCommitMessage.ts`
- Modify: `src/test/commitReviewPanel.test.ts`
- Modify: `src/test/generateCommitMessage.test.ts`

- [ ] **Step 4.1: Write failing test for regenerate button in HTML**

Add to `src/test/commitReviewPanel.test.ts`:

```typescript
it("renders a regenerate button in the generated (edit) view", () => {
  const html = renderCommitAssistantHtml(
    {
      ...baseData,
      message: { summary: "fix: something", description: "desc", riskLevel: "low" }
    },
    { cspSource: "vscode-resource:", nonce: "test-nonce" }
  );

  expect(html).toContain('id="regenerate"');
});
```

- [ ] **Step 4.2: Run to verify fails**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 3 "regenerate button"
```

Expected: FAIL.

- [ ] **Step 4.3: Add regenerate button to `renderGeneratedView` action bar**

In `src/ui/commitAssistantHtml.ts`, in `renderGeneratedView`, add the regenerate button to the action bar:

```typescript
    <div class="action-bar">
      <button id="commit" class="primary">Commit</button>
      <button id="push" class="push-btn" title="${escapeHtml(pushTitle)}" ${data.canPush && data.pendingPushCount ? "" : "disabled"}>&#8593; Push</button>
      <button id="commitAndPush" class="secondary" title="${escapeHtml(pushTitle)}" ${data.canPush ? "" : "disabled"}>Commit + Push</button>
      <button id="regenerate" class="secondary" title="Re-run AI with the same files">&#8635; Regenerate</button>
      <button id="copyMessage" class="copy-btn" title="Copy commit message to clipboard">&#10697; Copy</button>
    </div>
```

- [ ] **Step 4.4: Add regenerate JS handler in script block**

In the script section, add:

```javascript
document.getElementById("regenerate")?.addEventListener("click", () => {
  errorEl.style.display = "none";
  vscode.postMessage({ command: "regenerate" });
});
```

- [ ] **Step 4.5: Add `regenerate` to `CommitReviewHandlers` and `handleMessage`**

In `src/ui/commitReviewPanel.ts`, update the interface:

```typescript
export interface CommitReviewHandlers {
  generate: (files: string[]) => Promise<CommitReviewData>;
  regenerate: () => Promise<CommitReviewData>;
  commit: (message: string) => Promise<CommitReviewData | undefined>;
  push: () => Promise<CommitReviewData | undefined>;
  commitAndPush: (message: string) => Promise<CommitReviewData | undefined>;
  undoCommit: () => Promise<CommitReviewData | undefined>;
  reviewChanges: () => Promise<CommitReviewData | undefined>;
}
```

In `handleMessage`, add after the `generate` branch:

```typescript
    } else if (message.command === "regenerate") {
      const updatedData = await handlers.regenerate();
      setPanelHtml(panel, updatedData);
    } else if (message.command === "commit") {
```

- [ ] **Step 4.6: Write failing test for regenerate handler in generateCommitMessage**

Add to `src/test/generateCommitMessage.test.ts`:

```typescript
describe("regenerate handler", () => {
  it("re-runs generation with the previously selected files", async () => {
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);

    const openRouterClient = makeOpenRouterClient();
    const gitService = makeGitService();
    await generateCommitMessage(makeContext(), { gitService, openRouterClient });

    const handlers = getCapturedHandlers();
    // First generate to set generatedDiffContext
    await handlers.generate(["src/a.ts"]);
    // Now regenerate
    const result = await handlers.regenerate();
    expect(result.message?.summary).toBe("feat: test summary");
    expect(openRouterClient.generateCommitMessage).toHaveBeenCalledTimes(2);
  });

  it("throws UserInputError if regenerating before any generation", async () => {
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);

    await generateCommitMessage(makeContext(), {
      gitService: makeGitService(),
      openRouterClient: makeOpenRouterClient()
    });
    const handlers = getCapturedHandlers();
    await expect(handlers.regenerate()).rejects.toThrow(UserInputError);
  });
});
```

- [ ] **Step 4.7: Add `regenerate` callback in `generateCommitMessage.ts`**

In `src/commands/generateCommitMessage.ts`, in the `showCommitReviewPanel` call, add after the `generate` handler:

```typescript
              regenerate: async () => {
                if (!generatedDiffContext) {
                  throw new UserInputError("Generate a commit message before regenerating.");
                }
                return handlers.generate(generatedDiffContext.files);
              },
```

Where `handlers` refers to the object being built — since this is a self-referential object, extract the generate logic into a shared function. The simplest approach: call the same `generate` handler inline. Since the `generate` callback is already defined above `regenerate` in the same object literal, we can hoist the generate logic into a named inner function:

Replace the `showCommitReviewPanel` call's handlers with:

```typescript
          const generateFromFiles = async (files: string[]) => {
            const selectedDiffContext = filterDiffContextToFiles(currentDiffContext, files);
            if (
              selectedDiffContext.diff.trim().length === 0 ||
              selectedDiffContext.files.length === 0
            ) {
              throw new UserInputError("Select at least one safe changed file to summarize.");
            }

            const token = await getOrPromptForToken(context);
            if (!token) {
              throw new UserInputError(
                "Add an OpenRouter API key to generate a commit message."
              );
            }

            const [repositoryName, branchName, languageHints] = await Promise.all([
              getRepositoryName(workspacePath),
              getBranchName(workspacePath),
              detectLanguageHints(selectedDiffContext.files)
            ]);
            const prompt = buildCommitPrompt({
              repositoryName,
              branchName,
              diff: selectedDiffContext.diff,
              diffSource: selectedDiffContext.diffSource,
              files: selectedDiffContext.files,
              languageHints,
              stats: selectedDiffContext.stats,
              truncated: selectedDiffContext.truncated
            });
            let aiResponse: GenerateCommitResponse;
            try {
              aiResponse = await vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: "CommitCraft: generating smart Git commit",
                  cancellable: false
                },
                () =>
                  openRouterClient.generateCommitMessage({
                    token,
                    model: settings.openRouterModel,
                    fallbackModel: settings.fallbackModel,
                    prompt
                  })
              );
            } catch (err) {
              throw classifyNetworkError(err);
            }
            const parsed = parseCommitResponse(aiResponse.content);
            generatedDiffContext = selectedDiffContext;
            generatedMessage = parsed.message;
            generatedModelUsed = aiResponse.modelUsed;
            generatedRecovered = parsed.recovered;
            generatedRecoveryReason = parsed.recoveryReason;

            const [freshPushReadiness, freshPendingPushCount] = await Promise.all([
              gitService.getPushReadiness(workspacePath),
              gitService.getUnpushedCommitCount(workspacePath)
            ]);

            return {
              message: parsed.message,
              modelUsed: aiResponse.modelUsed,
              diffContext: selectedDiffContext,
              recovered: parsed.recovered,
              recoveryReason: parsed.recoveryReason,
              canPush: freshPushReadiness.canPush,
              pushDisabledReason: freshPushReadiness.canPush
                ? undefined
                : freshPushReadiness.reason,
              pendingPushCount: freshPendingPushCount,
              activityHistory
            };
          };

          const panel = showCommitReviewPanel(
            { ... },
            {
              generate: generateFromFiles,
              regenerate: async () => {
                if (!generatedDiffContext) {
                  throw new UserInputError("Generate a commit message before regenerating.");
                }
                return generateFromFiles(generatedDiffContext.files);
              },
              commit: async (message) => { ... },
              // ... rest unchanged
            },
            workspacePath
          );
```

- [ ] **Step 4.8: Write failing test for `handleMessage` regenerate in commitReviewPanel**

Add to `src/test/generateCommitMessage.test.ts` or create a dedicated block in the existing panel handler test section of `commitReviewPanel.test.ts`. In `commitReviewPanel.test.ts`, add:

```typescript
describe("handleMessage regenerate", () => {
  it("calls handlers.regenerate and updates panel HTML", async () => {
    const handlers: CommitReviewHandlers = {
      generate: vi.fn(),
      regenerate: vi
        .fn()
        .mockResolvedValue({
          ...baseReviewData,
          message: { summary: "regenerated", description: "", riskLevel: "low" }
        }),
      commit: vi.fn(),
      push: vi.fn(),
      commitAndPush: vi.fn(),
      undoCommit: vi.fn(),
      reviewChanges: vi.fn()
    };
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "regenerate" });
    expect(handlers.regenerate).toHaveBeenCalled();
    expect(panel.webview.html).toContain("regenerated");
  });
});
```

- [ ] **Step 4.9: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 4.10: Commit**

```bash
git add src/ui/commitAssistantHtml.ts src/ui/commitReviewPanel.ts src/commands/generateCommitMessage.ts src/test/commitReviewPanel.test.ts src/test/generateCommitMessage.test.ts
git commit -m "feat: regenerate button re-runs AI with same file selection"
```

---

## Task 5: Install coverage tooling and configure thresholds

**Files:**

- Modify: `package.json`
- Modify: `vitest.config.ts`

- [ ] **Step 5.1: Install `@vitest/coverage-v8`**

```bash
npm install --save-dev @vitest/coverage-v8
```

- [ ] **Step 5.2: Add `test:coverage` script to `package.json`**

In the `"scripts"` section, add:

```json
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5.3: Update `vitest.config.ts` to enable coverage with thresholds and source inclusion**

Replace the full file:

```typescript
import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "src/test/mocks/vscode.ts")
    }
  },
  test: {
    environment: "node",
    include: ["src/test/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/test/**", "dist/**"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95
      }
    }
  }
});
```

- [ ] **Step 5.4: Run coverage to see baseline (will fail threshold, that's OK)**

```bash
npm run test:coverage 2>&1 | tail -30
```

Expected: see a coverage table; thresholds may fail showing which files need more tests.

- [ ] **Step 5.5: Commit tooling setup**

```bash
git add package.json vitest.config.ts package-lock.json
git commit -m "build: add @vitest/coverage-v8 with 95% thresholds"
```

---

## Task 6: Coverage — `notifications.ts` (new test file)

**Files:**

- Create: `src/test/notifications.test.ts`

- [ ] **Step 6.1: Write full coverage test for `notifications.ts`**

Create `src/test/notifications.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

import * as vscode from "vscode";
import { confirmAction, showInfo, showPlainError, showRetryableError } from "../ui/notifications";
import { resetVscodeMocks } from "./mocks/vscode";

beforeEach(() => {
  resetVscodeMocks();
});

describe("showPlainError", () => {
  it("calls showErrorMessage with CommitCraft prefix", async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
    await showPlainError("something went wrong");
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "CommitCraft: something went wrong"
    );
  });
});

describe("showRetryableError", () => {
  it("calls showErrorMessage with Retry button", async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
    await showRetryableError("network failed");
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "CommitCraft: network failed",
      "Retry"
    );
  });

  it("returns 'Retry' when user clicks Retry", async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue("Retry" as never);
    const result = await showRetryableError("network failed");
    expect(result).toBe("Retry");
  });
});

describe("showInfo", () => {
  it("calls showInformationMessage with CommitCraft prefix", async () => {
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);
    await showInfo("commit created");
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "CommitCraft: commit created"
    );
  });
});

describe("confirmAction", () => {
  it("returns true when user clicks the action button", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Push" as never);
    const result = await confirmAction("Push main to origin?", "Push");
    expect(result).toBe(true);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "Push main to origin?",
      { modal: true },
      "Push"
    );
  });

  it("returns false when user dismisses the dialog", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
    const result = await confirmAction("Push main to origin?", "Push");
    expect(result).toBe(false);
  });

  it("returns false when user clicks a different button (impossible but defensive)", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Cancel" as never);
    const result = await confirmAction("Push?", "Push");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 6.2: Run tests**

```bash
npm test
```

Expected: all pass including the 4 new notification tests.

- [ ] **Step 6.3: Commit**

```bash
git add src/test/notifications.test.ts
git commit -m "test: full coverage for notifications.ts"
```

---

## Task 7: Coverage — `commitAssistantHtml.ts` missing branches

**Files:**

- Modify: `src/test/commitReviewPanel.test.ts`

Add the following test cases to cover uncovered branches:

- [ ] **Step 7.1: Write missing branch tests**

Add to `src/test/commitReviewPanel.test.ts`:

```typescript
describe("renderCommitAssistantHtml — coverage gaps", () => {
  it("renders truncation warning when diff was truncated", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        diffContext: {
          ...baseDiffContext,
          truncated: true,
          warnings: ["Diff was truncated at 60000 characters."]
        }
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("Diff was truncated");
  });

  it("renders recovery warning when message was recovered from malformed JSON", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "fix: recovered", description: "", riskLevel: "low" },
        recovered: true,
        recoveryReason: "missing closing brace"
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("Recovered non-JSON response");
    expect(html).toContain("missing closing brace");
  });

  it("renders activity history when commit and push actions are present", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: x", description: "", riskLevel: "low" },
        activityHistory: [
          { type: "commit", title: "Committed", detail: "feat: x", hash: "abc1234" },
          { type: "push", title: "Pushed", detail: "main to origin" }
        ]
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("Committed");
    expect(html).toContain("Pushed");
    expect(html).toContain("main to origin");
    expect(html).toContain("abc1234");
  });

  it("renders undo activity items", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: x", description: "", riskLevel: "low" },
        activityHistory: [{ type: "undo", title: "Undid Commit", detail: "Changes kept staged." }]
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("Undid Commit");
    expect(html).toContain("Changes kept staged.");
  });

  it("renders post-commit 'pushed' state with no action bar", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: done", description: "", riskLevel: "low" },
        commitState: { status: "pushed", commitHash: "abc1234" },
        canReviewChanges: false
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("Pushed");
    expect(html).toContain("abc1234");
    expect(html).not.toContain('id="push"');
  });

  it("renders post-commit 'pushed' state with review-changes button when changes remain", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: done", description: "", riskLevel: "low" },
        commitState: { status: "pushed", commitHash: "abc1234" },
        canReviewChanges: true
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain('id="reviewChanges"');
  });

  it("renders post-commit 'pendingPush' state", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: done", description: "", riskLevel: "low" },
        commitState: { status: "pendingPush", commitHash: "abc1234" },
        pendingPushCount: 2,
        canPush: true
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("Ready to Push");
    expect(html).toContain('id="undoCommit"');
  });

  it("renders 'No safe text files' message when file list is empty", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        diffContext: { ...baseDiffContext, files: [], excludedFiles: [] }
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("No safe text files");
  });

  it("renders push-disabled message in edit view when canPush is false", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: x", description: "", riskLevel: "low" },
        canPush: false,
        pushDisabledReason: "No remote configured."
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("No remote configured.");
  });

  it("renders Push button disabled in edit view when pendingPushCount is 0", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: x", description: "", riskLevel: "low" },
        canPush: true,
        pendingPushCount: 0
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain('id="push"');
    const pushButtonMatch = html.match(/id="push"[^>]*>/);
    expect(pushButtonMatch?.[0]).toContain("disabled");
  });

  it("renders pendingPushPanel when unpushed commits exist in preview view", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        pendingPushCount: 3,
        canPush: true
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("push-banner");
  });

  it("shows model pill when modelUsed is set", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "fix: x", description: "", riskLevel: "low" },
        modelUsed: "openai/gpt-4o-mini-2024-07-18"
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("gpt-4o-mini");
  });

  it("renders high risk pill in red", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "feat: big change", description: "", riskLevel: "high" }
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("pill-removed");
    expect(html).toContain("risk: high");
  });

  it("renders medium risk pill in yellow", () => {
    const html = renderCommitAssistantHtml(
      {
        ...baseData,
        message: { summary: "fix: medium", description: "", riskLevel: "medium" }
      },
      { cspSource: "vscode-resource:", nonce: "n" }
    );
    expect(html).toContain("pill-warn");
  });
});
```

- [ ] **Step 7.2: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7.3: Commit**

```bash
git add src/test/commitReviewPanel.test.ts
git commit -m "test: cover all HTML rendering branches in commitAssistantHtml"
```

---

## Task 8: Coverage — `commitReviewPanel.ts` handler paths

**Files:**

- Modify: `src/test/commitReviewPanel.test.ts`

The handler tests need to cover: error posting, path traversal guard on `openFile`, each message command, and the `isActionInProgress` guard.

- [ ] **Step 8.1: Write handler coverage tests**

Add a new `describe("showCommitReviewPanel handlers", ...)` block with the following tests. First, find the `baseReviewData` fixture used in the existing panel tests and confirm it includes `pendingPushCount`. If not, define it:

```typescript
const baseReviewData: CommitReviewData = {
  diffContext: baseDiffContext,
  canPush: true,
  recovered: false,
  pendingPushCount: 0
};
```

Then add:

```typescript
import { showCommitReviewPanel, type CommitReviewHandlers } from "../ui/commitReviewPanel";

function makeHandlers(overrides: Partial<CommitReviewHandlers> = {}): CommitReviewHandlers {
  return {
    generate: vi.fn().mockResolvedValue(baseReviewData),
    regenerate: vi.fn().mockResolvedValue(baseReviewData),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    commitAndPush: vi.fn().mockResolvedValue(undefined),
    undoCommit: vi.fn().mockResolvedValue(undefined),
    reviewChanges: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("showCommitReviewPanel handlers", () => {
  beforeEach(() => resetVscodeMocks());

  it("calls generate handler and updates panel HTML", async () => {
    const handlers = makeHandlers({
      generate: vi.fn().mockResolvedValue({
        ...baseReviewData,
        message: { summary: "feat: from generate", description: "", riskLevel: "low" }
      })
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "generate", files: ["src/a.ts"] });
    expect(handlers.generate).toHaveBeenCalledWith(["src/a.ts"]);
    expect(panel.webview.html).toContain("feat: from generate");
  });

  it("calls commit handler and updates panel when data returned", async () => {
    const handlers = makeHandlers({
      commit: vi.fn().mockResolvedValue({
        ...baseReviewData,
        commitState: { status: "committed", commitHash: "abc" }
      })
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "commit", message: "fix: something" });
    expect(handlers.commit).toHaveBeenCalledWith("fix: something");
  });

  it("does not update panel when commit handler returns undefined (user cancelled)", async () => {
    const handlers = makeHandlers({ commit: vi.fn().mockResolvedValue(undefined) });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const initialHtml = panel.webview.html;
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "commit", message: "fix: x" });
    expect(panel.webview.html).toBe(initialHtml);
  });

  it("posts error message to webview when handler throws", async () => {
    const handlers = makeHandlers({
      commit: vi.fn().mockRejectedValue(new Error("git exploded"))
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "commit", message: "fix: x" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      command: "error",
      text: "git exploded"
    });
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it("posts CommitCraftError userMessage on typed errors", async () => {
    const { UserInputError } = await import("../errors");
    const handlers = makeHandlers({
      commit: vi.fn().mockRejectedValue(new UserInputError("No files selected."))
    });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "commit", message: "" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      command: "error",
      text: "No files selected."
    });
  });

  it("blocks a second action while one is in progress", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<CommitReviewData>((res) => {
      resolveFirst = () => res(baseReviewData);
    });
    const handlers = makeHandlers({ push: vi.fn().mockReturnValue(first) });
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    void listener({ command: "push" });
    void listener({ command: "push" });
    resolveFirst();
    await first;
    // Despite two messages, push should only be called once
    expect(handlers.push).toHaveBeenCalledTimes(1);
  });

  it("opens a file within the workspace", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "openFile", path: "src/a.ts" });
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/workspace/src/a.ts" })
    );
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
  });

  it("throws when openFile path escapes the workspace", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "openFile", path: "../../../etc/passwd" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: "error" })
    );
  });

  it("ignores unknown message commands", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener({ command: "unknownCommand" });
    expect(handlers.generate).not.toHaveBeenCalled();
    expect(handlers.commit).not.toHaveBeenCalled();
  });

  it("ignores non-object messages", async () => {
    const handlers = makeHandlers();
    const panel = showCommitReviewPanel(baseReviewData, handlers, "/workspace");
    const listener = vi.mocked(panel.webview.onDidReceiveMessage).mock.calls[0][0];
    await listener("not an object");
    await listener(null);
    await listener(42);
    expect(handlers.generate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8.2: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 8.3: Run coverage report**

```bash
npm run test:coverage 2>&1 | tail -20
```

Expected: coverage at or near 95% across lines/functions/branches.

- [ ] **Step 8.4: Commit**

```bash
git add src/test/commitReviewPanel.test.ts
git commit -m "test: full handler coverage for commitReviewPanel.ts"
```

---

## Task 9: Coverage — `generateCommitMessage.ts` network error paths

**Files:**

- Modify: `src/test/generateCommitMessage.test.ts`

- [ ] **Step 9.1: Write classifyNetworkError coverage tests**

Add to `src/test/generateCommitMessage.test.ts`:

```typescript
describe("network error classification", () => {
  it("classifies timeout errors", async () => {
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);

    const openRouterClient = makeOpenRouterClient({
      generateCommitMessage: vi.fn().mockRejectedValue(new Error("request timed out after 30s"))
    });
    await generateCommitMessage(makeContext(), { gitService: makeGitService(), openRouterClient });
    const handlers = getCapturedHandlers();
    await expect(handlers.generate(["src/a.ts"])).rejects.toThrow("Request timed out");
  });

  it("classifies 401 auth errors", async () => {
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);

    const openRouterClient = makeOpenRouterClient({
      generateCommitMessage: vi.fn().mockRejectedValue(new Error("401 unauthorized"))
    });
    await generateCommitMessage(makeContext(), { gitService: makeGitService(), openRouterClient });
    const handlers = getCapturedHandlers();
    await expect(handlers.generate(["src/a.ts"])).rejects.toThrow("Invalid API key");
  });

  it("classifies 429 rate limit errors", async () => {
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);

    const openRouterClient = makeOpenRouterClient({
      generateCommitMessage: vi.fn().mockRejectedValue(new Error("429 rate limit exceeded"))
    });
    await generateCommitMessage(makeContext(), { gitService: makeGitService(), openRouterClient });
    const handlers = getCapturedHandlers();
    await expect(handlers.generate(["src/a.ts"])).rejects.toThrow("Rate limit hit");
  });

  it("classifies 500 server errors", async () => {
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);

    const openRouterClient = makeOpenRouterClient({
      generateCommitMessage: vi.fn().mockRejectedValue(new Error("500 internal server error"))
    });
    await generateCommitMessage(makeContext(), { gitService: makeGitService(), openRouterClient });
    const handlers = getCapturedHandlers();
    await expect(handlers.generate(["src/a.ts"])).rejects.toThrow(
      "OpenRouter is temporarily unavailable"
    );
  });

  it("passes through NetworkError unchanged", async () => {
    vi.mocked(diffCollector.collectDiffContext).mockResolvedValue(makeDiffContext());
    vi.mocked(diffCollector.getBranchName).mockResolvedValue("main");
    vi.mocked(diffCollector.getRepositoryName).mockResolvedValue("repo");
    vi.mocked(diffCollector.detectLanguageHints).mockResolvedValue([]);

    const openRouterClient = makeOpenRouterClient({
      generateCommitMessage: vi
        .fn()
        .mockRejectedValue(new NetworkError("already classified", "raw"))
    });
    await generateCommitMessage(makeContext(), { gitService: makeGitService(), openRouterClient });
    const handlers = getCapturedHandlers();
    await expect(handlers.generate(["src/a.ts"])).rejects.toThrow("already classified");
  });
});
```

- [ ] **Step 9.2: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 9.3: Run coverage**

```bash
npm run test:coverage 2>&1 | grep -E "All|lines|branches|functions|statements|%"
```

Expected: 95%+ across all metrics.

- [ ] **Step 9.4: Commit**

```bash
git add src/test/generateCommitMessage.test.ts
git commit -m "test: coverage for network error classification and error paths"
```

---

## Task 10: GitHub Actions CI + Slack notification

**Files:**

- Create: `.github/workflows/test.yml`

- [ ] **Step 10.1: Create the GitHub Actions workflow**

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  test:
    name: Test & Coverage
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Compile TypeScript
        run: npm run compile

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Run tests with coverage
        id: test
        run: npm run test:coverage
        continue-on-error: true

      - name: Read coverage summary
        id: coverage
        if: always()
        run: |
          if [ -f coverage/coverage-summary.json ]; then
            LINES=$(node -e "const c=require('./coverage/coverage-summary.json');console.log(c.total.lines.pct)")
            BRANCHES=$(node -e "const c=require('./coverage/coverage-summary.json');console.log(c.total.branches.pct)")
            FUNCS=$(node -e "const c=require('./coverage/coverage-summary.json');console.log(c.total.functions.pct)")
            echo "lines=$LINES" >> $GITHUB_OUTPUT
            echo "branches=$BRANCHES" >> $GITHUB_OUTPUT
            echo "functions=$FUNCS" >> $GITHUB_OUTPUT
          else
            echo "lines=N/A" >> $GITHUB_OUTPUT
            echo "branches=N/A" >> $GITHUB_OUTPUT
            echo "functions=N/A" >> $GITHUB_OUTPUT
          fi

      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v2.0.0
        with:
          webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
          webhook-type: incoming-webhook
          payload: |
            {
              "text": "${{ steps.test.outcome == 'success' && ':white_check_mark:' || ':x:' }} *CommitCraft AI* — Tests ${{ steps.test.outcome == 'success' && 'passed' || 'FAILED' }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "${{ steps.test.outcome == 'success' && ':white_check_mark:' || ':x:' }} *CommitCraft AI* — Tests ${{ steps.test.outcome == 'success' && 'passed' || 'FAILED' }}\n*Branch:* `${{ github.ref_name }}`\n*Commit:* <${{ github.server_url }}/${{ github.repository }}/commit/${{ github.sha }}|`${{ github.sha && substr(github.sha, 0, 7) }}`> by ${{ github.actor }}"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    { "type": "mrkdwn", "text": "*Lines:* ${{ steps.coverage.outputs.lines }}%" },
                    { "type": "mrkdwn", "text": "*Branches:* ${{ steps.coverage.outputs.branches }}%" },
                    { "type": "mrkdwn", "text": "*Functions:* ${{ steps.coverage.outputs.functions }}%" },
                    { "type": "mrkdwn", "text": "*Workflow:* <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Run>" }
                  ]
                }
              ]
            }
```

- [ ] **Step 10.2: Verify the workflow file is valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`

- [ ] **Step 10.3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: GitHub Actions workflow — test + coverage + Slack notification"
```

---

## Task 11: Final package build and version

**Files:**

- Modify: `package.json` (version stays 0.3.1 — all changes are patch-level additions to the same release)

- [ ] **Step 11.1: Run full test:coverage one final time**

```bash
npm run test:coverage 2>&1 | tail -20
```

Expected: all coverage thresholds pass at ≥95%.

- [ ] **Step 11.2: Package**

```bash
npm run package
```

Expected: `DONE Packaged: commitcraft-ai-smart-git-commits-0.3.1.vsix`

- [ ] **Step 11.3: Final commit if any packaging files changed**

```bash
git status
```

Only commit if non-build files changed.

---

## Post-Implementation: Slack Webhook Setup

After merging, add the Slack webhook URL as a repository secret:

1. Create an Incoming Webhook in your Slack workspace (Apps → Incoming Webhooks → Add New Webhook)
2. In GitHub: `Settings → Secrets and variables → Actions → New repository secret`
3. Name: `SLACK_WEBHOOK_URL`, Value: your Slack webhook URL

The workflow will post ✅ or ❌ with coverage numbers to the configured channel on every push.
