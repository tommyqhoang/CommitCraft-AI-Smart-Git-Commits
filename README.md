# CommitCraft AI: Smart Git Commits

CommitCraft AI is a Visual Studio Code extension that helps developers turn local Git changes into clear, editable commit messages with OpenRouter. It opens a focused commit assistant, shows the files that will be summarized, asks for an OpenRouter API key only when needed, generates a commit message, then lets the user commit, push, or commit-and-push with confirmation.

The extension is intentionally not autonomous. It never commits or pushes without an explicit user action.

## Features

- Open a single **CommitCraft: Open Commit Assistant** workflow from the Command Palette, Source Control title button, or status bar.
- Preview changed files before sending anything to OpenRouter.
- Choose which safe files should be summarized.
- Prefer staged changes when staged changes exist.
- Fall back to safe unstaged and untracked files when nothing is staged.
- Show change stats: files changed, lines added, and lines removed.
- Show excluded files with reasons, such as secret-like file, lockfile, binary/generated asset, or file too large.
- Generate editable conventional-style commit messages through OpenRouter.
- Store the OpenRouter API key in VS Code `SecretStorage`.
- Commit, push, or commit-and-push only after user confirmation.
- Support multi-root workspaces by preferring the workspace that contains the active editor.

## How To Use

1. Open a Git repository in VS Code.
2. Make local changes.
3. Run **CommitCraft: Open Commit Assistant** from the Command Palette, click the Source Control sparkle button, or click **CommitCraft** in the status bar.
4. Review the changed files, excluded files, and line stats.
5. Select the safe files you want CommitCraft to summarize.
6. Click **Generate Message**.
7. If prompted, paste your OpenRouter API key. It is stored in VS Code `SecretStorage`.
8. Review and edit the generated commit message.
9. Click **Commit**, **Push**, or **Commit and Push**.
10. Confirm the Git action in VS Code before it runs.

## Commands

| Command                                   | Purpose                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `CommitCraft: Open Commit Assistant`      | Primary workflow for reviewing changes, generating a message, committing, and pushing. |
| `CommitCraft: Set OpenRouter API Token`   | Saves or replaces the OpenRouter API key in VS Code `SecretStorage`.                   |
| `CommitCraft: Clear OpenRouter API Token` | Removes the saved OpenRouter API key.                                                  |

`CommitCraft: Generate Smart Git Commit` is still registered for backward compatibility, but it is hidden from the Command Palette. Use **Open Commit Assistant** for the current workflow.

## Settings

```json
{
  "commitCraft.openRouterModel": "openrouter/auto",
  "commitCraft.fallbackModel": "openrouter/free",
  "commitCraft.maxDiffCharacters": 60000,
  "commitCraft.includeUntrackedFiles": true
}
```

| Setting                             | Default           | Description                                                                      |
| ----------------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| `commitCraft.openRouterModel`       | `openrouter/auto` | Primary OpenRouter model used for commit message generation.                     |
| `commitCraft.fallbackModel`         | `openrouter/free` | Fallback model used when the primary model fails for retryable reasons.          |
| `commitCraft.maxDiffCharacters`     | `60000`           | Maximum diff size sent to OpenRouter. Larger diffs are truncated with a warning. |
| `commitCraft.includeUntrackedFiles` | `true`            | Includes safe untracked text files when no staged changes exist.                 |

## Safety Model

CommitCraft is designed to keep the developer in control:

- API keys are stored only in VS Code `SecretStorage`.
- API keys are never sent in prompts and are redacted from surfaced OpenRouter error bodies.
- `.env`, secret-like paths, certificate/key files, lockfiles, binary/generated assets, and oversized untracked files are excluded from prompt context.
- Excluded files are shown in the assistant before generation.
- Staged changes are preferred. If staged changes exist, unstaged and untracked files are not summarized.
- If no staged changes exist, the assistant shows safe unstaged and untracked files for selection.
- Commit and push actions always require confirmation.
- Push is disabled when the repository has no remote or is in a detached HEAD state.

## Commit Message Format

CommitCraft asks OpenRouter for structured JSON and renders the result as an editable commit message:

```text
<type>: <short summary>

<description>
```

Supported commit types include:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `build`
- `ci`
- `style`
- `perf`
- `revert`

Example:

```text
feat: add commit assistant preview

Adds a review step that lets users select safe changed files before generating a commit message.
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
- `git/` owns Git status, diff collection, file safety filtering, change stats, commit, push, and push readiness.
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

Development scripts:

| Script                 | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `npm run compile`      | Type-checks and builds the extension into `dist/`. |
| `npm run watch`        | Runs TypeScript in watch mode.                     |
| `npm test`             | Runs Vitest unit tests.                            |
| `npm run lint`         | Runs ESLint.                                       |
| `npm run format`       | Formats the repository with Prettier.              |
| `npm run format:check` | Checks Prettier formatting.                        |
| `npm run vscode:test`  | Runs VS Code extension-host tests.                 |
| `npm run package`      | Builds a `.vsix` package with `vsce`.              |

## Testing

The test suite covers:

- Change-stat calculation.
- Diff safety filtering.
- Excluded-file reasons.
- Selected-file diff filtering.
- Prompt generation.
- OpenRouter fallback behavior.
- Response parsing and plain-text recovery.
- Settings defaults and normalization.
- Workspace selection for multi-root workspaces.
- Assistant HTML rendering.
- VS Code command registration.

Manual QA steps live in [docs/MANUAL_QA.md](docs/MANUAL_QA.md).

## Packaging

Build a VSIX package:

```bash
npm run package
```

The package is written to:

```text
commitcraft-ai-smart-git-commits-0.1.1.vsix
```

## Non-Goals

- Fully autonomous commits.
- Fully autonomous pushes.
- Rewriting user code.
- Replacing pull request descriptions.
- Managing provider-specific pull request or issue workflows.

## License

This project is licensed under the MIT License.
