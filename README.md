# CommitCraft AI: Smart Git Commits

CommitCraft AI is a Visual Studio Code extension that turns local Git changes into clear, editable commit messages using OpenRouter. It opens a focused commit assistant, shows the files that will be summarized, asks for an OpenRouter API key only when needed, generates a structured commit message, then lets you commit, push, or commit-and-push with confirmation.

The extension is intentionally not autonomous. It never commits or pushes without an explicit user action.

## Requirements

- VS Code 1.96 or later.
- A free or paid [OpenRouter](https://openrouter.ai) account. The API key is stored in VS Code `SecretStorage` — never in settings files.

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=CommitCraftAISmartGitCommits.commitcraft-ai-smart-git-commits) or search **CommitCraft AI** inside VS Code.

## Quick Start

1. Open a Git repository in VS Code and make some changes.
2. Run **CommitCraft: Open Commit Assistant** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), click the sparkle button in the Source Control title bar, or click **CommitCraft** in the status bar.
3. If prompted, paste your OpenRouter API key.
4. Review the changed files and deselect any you don't want included.
5. Click **Generate Message →**.
6. Edit the summary and description as needed.
7. Click **Commit**, **↑ Push**, or **Commit + Push**.
8. Confirm the Git action when prompted.

## Features

- **Single-command workflow** — one entry point from the Command Palette, Source Control title bar, or status bar.
- **File selection** — review and choose which safe files CommitCraft sends to OpenRouter before anything is generated.
- **Staged-first** — uses staged changes when they exist; falls back to safe unstaged and untracked files when nothing is staged.
- **Change stats** — shows files changed, lines added, and lines removed at a glance.
- **Excluded file transparency** — lists excluded files with the reason (secret-like file, lockfile, binary/generated asset, file too large).
- **Editable message** — generates a structured summary line and multi-line description you can revise before committing.
- **Commit type + risk badge** — displays the detected conventional commit type and a risk level so you can quickly assess the change.
- **Activity timeline** — tracks commits, pushes, and undos performed during the session.
- **Undo commit** — unstages the last local commit and keeps the changes staged for revision.
- **Pending push awareness** — shows a banner when unpushed local commits exist and offers a direct push action.
- **Multi-root workspace support** — prefers the workspace folder that contains the active editor.
- **Safe by default** — `.env`, secret-like paths, certificate/key files, lockfiles, binary/generated assets, and oversized files are excluded from the prompt.

## How To Use

1. Open a Git repository in VS Code.
2. Make local changes.
3. Run **CommitCraft: Open Commit Assistant** from the Command Palette, click the Source Control sparkle button, or click **CommitCraft** in the status bar.
4. Review the changed files, excluded files, and diff statistics.
5. Deselect any files you don't want summarized.
6. Click **Generate Message →**.
7. If prompted, paste your OpenRouter API key. It is stored in VS Code `SecretStorage`.
8. Review and edit the generated summary and description.
9. Click **Commit**, **↑ Push**, or **Commit + Push**.
10. Confirm the Git action before it runs.

## Commands

| Command                                   | Purpose                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `CommitCraft: Open Commit Assistant`      | Primary workflow for reviewing changes, generating a message, committing, and pushing. |
| `CommitCraft: Set OpenRouter API Token`   | Saves or replaces the OpenRouter API key in VS Code `SecretStorage`.                   |
| `CommitCraft: Clear OpenRouter API Token` | Removes the saved OpenRouter API key.                                                  |

`CommitCraft: Generate Smart Git Commit` is still registered for backward compatibility but is hidden from the Command Palette. Use **Open Commit Assistant** for the current workflow.

## Settings

```json
{
  "commitCraft.openRouterModel": "openrouter/auto",
  "commitCraft.fallbackModel": "openrouter/free",
  "commitCraft.maxDiffCharacters": 60000,
  "commitCraft.includeUntrackedFiles": true
}
```

| Setting                             | Default           | Description                                                                    |
| ----------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| `commitCraft.openRouterModel`       | `openrouter/auto` | Primary OpenRouter model used for commit message generation.                   |
| `commitCraft.fallbackModel`         | `openrouter/free` | Fallback model used when the primary model fails for retryable reasons.        |
| `commitCraft.maxDiffCharacters`     | `60000`           | Maximum diff size (characters) sent to OpenRouter. Larger diffs are truncated. |
| `commitCraft.includeUntrackedFiles` | `true`            | Include safe untracked text files when no staged changes exist.                |

## Safety Model

CommitCraft keeps the developer in control:

- API keys are stored only in VS Code `SecretStorage` and are never written to settings files or sent in prompts.
- API keys are redacted from surfaced OpenRouter error messages.
- `.env`, secret-like paths, certificate/key files, lockfiles, binary/generated assets, and oversized untracked files are excluded from prompt context.
- Excluded files are shown in the assistant before generation so nothing is hidden.
- Staged changes are preferred. When staged changes exist, unstaged and untracked files are not summarized.
- Commit and push actions always require confirmation.
- Push is disabled when the repository has no remote or is in a detached HEAD state.

## Commit Message Format

CommitCraft requests structured JSON from OpenRouter and renders it as an editable commit message:

```text
<type>: <short summary>

<description>
```

Supported commit types:

`feat` `fix` `docs` `refactor` `test` `chore` `build` `ci` `style` `perf` `revert`

Example:

```text
feat: add commit assistant preview

Adds a review step that lets users select safe changed files before
generating a commit message.
```

## Architecture

```text
src/
  extension.ts
  commands/
    generateCommitMessage.ts
    setOpenRouterToken.ts
    clearOpenRouterToken.ts
    workspaceResolver.ts
  config/
    settings.ts
    vscodeSettings.ts
  git/
    changeStats.ts
    diffCollector.ts
    gitService.ts
  openrouter/
    commitPrompt.ts
    openRouterClient.ts
    responseParser.ts
  ui/
    commitAssistantHtml.ts
    commitReviewPanel.ts
    notifications.ts
  test/
    *.test.ts
    suite/
```

Key boundaries:

- `commands/` owns VS Code command flow and workspace selection.
- `git/` owns Git status, diff collection, file safety filtering, change stats, commit, push, undo, and push readiness.
- `openrouter/` owns prompt creation, OpenRouter API calls, fallback behavior, response validation, and response recovery.
- `ui/` owns the assistant webview, HTML rendering, notifications, and confirmation prompts.
- `config/` owns extension settings and defaults.

## Development

Install dependencies:

```bash
npm install
```

Common commands:

```bash
npm run compile
npm test
npm run lint
npm run format:check
npm run vscode:test
npm run package
```

| Script                 | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `npm run compile`      | Type-checks and builds the extension into `dist/`. |
| `npm run watch`        | Runs TypeScript in watch mode.                     |
| `npm test`             | Runs Vitest unit tests.                            |
| `npm run lint`         | Runs ESLint.                                       |
| `npm run format`       | Formats the repository with Prettier.              |
| `npm run format:check` | Checks Prettier formatting without writing.        |
| `npm run vscode:test`  | Runs VS Code extension-host integration tests.     |
| `npm run package`      | Builds a `.vsix` package with `vsce`.              |

## Testing

The test suite covers:

- Change-stat calculation.
- Diff safety filtering and excluded-file reasons.
- Selected-file diff filtering.
- Prompt generation.
- OpenRouter client fallback behavior and timeout handling.
- Response parsing and plain-text recovery.
- Settings defaults and normalization.
- Workspace selection for multi-root workspaces.
- Assistant HTML rendering (preview, generated, post-commit, and activity history views).
- Committed state and undo commit behavior.
- VS Code command registration.

Manual QA steps live in [docs/MANUAL_QA.md](docs/MANUAL_QA.md).

## Packaging

```bash
npm run package
```

Produces: `commitcraft-ai-smart-git-commits-0.1.1.vsix`

## Non-Goals

- Fully autonomous commits or pushes.
- Rewriting user code.
- Replacing pull request descriptions.
- Managing provider-specific pull request or issue workflows.

## License

MIT
