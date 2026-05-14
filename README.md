<p align="center">
  <img src="assets/icon.png" width="128" alt="CommitCraft AI icon" />
</p>

<h1 align="center">CommitCraft AI: Smart Git Commits</h1>

<p align="center">
  Review local Git changes, generate a conventional commit message with OpenRouter, then commit or push from a guarded VS Code panel.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=CommitCraftAISmartGitCommits.commitcraft-ai-smart-git-commits">
    <img src="https://img.shields.io/visual-studio-marketplace/v/CommitCraftAISmartGitCommits.commitcraft-ai-smart-git-commits?label=VS%20Code%20Marketplace&color=0078d4" alt="Marketplace version" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=CommitCraftAISmartGitCommits.commitcraft-ai-smart-git-commits">
    <img src="https://img.shields.io/visual-studio-marketplace/d/CommitCraftAISmartGitCommits.commitcraft-ai-smart-git-commits?color=0078d4" alt="Marketplace installs" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license" />
</p>

---

CommitCraft AI is a VS Code commit assistant for developers who want better commit messages without handing over Git control. It opens from the Command Palette, Source Control title bar, or status bar, shows the exact files that can be summarized, sends only safe selected text diffs to OpenRouter, and renders an editable commit message before any Git action runs.

Nothing is committed or pushed automatically. The extension always requires a button click, and push/undo operations still use confirmation prompts.

## What You Can Do

- Review changed files before an AI request is made.
- Generate a conventional commit summary and description from selected safe diffs.
- Edit the summary and description in separate fields with a 72-character summary counter.
- Copy the generated commit message to the clipboard.
- Regenerate a message for the same selected files.
- Commit selected files, push pending commits, or commit and push in one flow.
- Undo the last local commit with a soft reset that keeps changes staged.
- See file counts, line additions/removals, model used, risk level, pending pushes, and session history.

## Requirements

- VS Code 1.96 or later
- A Git repository opened in VS Code
- An [OpenRouter](https://openrouter.ai) API key

Your API key is stored in VS Code `SecretStorage`. It is not written to settings files and is not included in prompts.

## Quick Start

1. Open a Git repository in VS Code.
2. Make or stage changes.
3. Open **CommitCraft: Open Commit Assistant** from the Command Palette, the Source Control title bar, or the **CommitCraft** status bar item.
4. Add your OpenRouter API key when prompted.
5. Review the safe changed files and deselect anything you do not want summarized.
6. Select **Generate Message**.
7. Edit the generated summary or description if needed.
8. Select **Commit**, **Push**, or **Commit + Push**.

## Commands

| Command                                   | Purpose                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `CommitCraft: Open Commit Assistant`      | Main workflow for review, generation, commit, push, and undo actions.  |
| `CommitCraft: Set OpenRouter API Token`   | Save or replace your OpenRouter API key in VS Code `SecretStorage`.    |
| `CommitCraft: Clear OpenRouter API Token` | Delete the saved OpenRouter API key from VS Code `SecretStorage`.      |
| `CommitCraft: Generate Smart Git Commit`  | Legacy alias hidden from the Command Palette; routes to the assistant. |

## Settings

| Setting                              | Default           | Description                                                                  |
| ------------------------------------ | ----------------- | ---------------------------------------------------------------------------- |
| `commitCraft.openRouterModel`        | `openrouter/auto` | Primary OpenRouter model for commit message generation.                      |
| `commitCraft.fallbackModel`          | `openrouter/free` | Fallback model used when the primary model fails with a retryable error.     |
| `commitCraft.maxDiffCharacters`      | `60000`           | Maximum diff characters sent to OpenRouter. Valid range: `1000`-`200000`.    |
| `commitCraft.includeUntrackedFiles`  | `true`            | Include safe untracked text files when there are no staged changes.          |
| `commitCraft.skipCommitConfirmation` | `false`           | Skip the extra commit confirmation dialog after reviewing the panel content. |

Example:

```json
{
  "commitCraft.openRouterModel": "openrouter/auto",
  "commitCraft.fallbackModel": "openrouter/free",
  "commitCraft.maxDiffCharacters": 60000,
  "commitCraft.includeUntrackedFiles": true,
  "commitCraft.skipCommitConfirmation": false
}
```

## How File Selection Works

CommitCraft prefers staged changes. If staged changes exist, only staged files are considered. If nothing is staged, it can summarize safe unstaged and untracked text files.

Before generation, the assistant shows:

- Files that can be summarized
- Files excluded from the prompt
- The exclusion reason
- Change statistics for the current diff

Excluded file categories include:

- `.env` files and secret-like paths
- Certificate and key files
- Lockfiles
- Binary and generated assets
- Oversized files
- Symlinks and unsupported untracked file types

## Generated Message Format

CommitCraft asks OpenRouter for structured JSON and renders it as an editable conventional commit:

```text
<type>(<scope>): <short summary>

<description>
```

Supported commit types:

```text
feat fix docs refactor test chore build ci style perf revert
```

If a model returns malformed JSON or an unsupported commit type, CommitCraft falls back to a safe editable message and shows a recovery warning in the panel.

## Safety & Privacy

- OpenRouter API keys are stored only in VS Code `SecretStorage`.
- API keys are never sent in prompts and are redacted from surfaced OpenRouter errors.
- The panel shows the exact safe files available for prompt context before generation.
- Ignored, binary, oversized, secret-like, symlinked, and unsupported untracked files are excluded.
- Commit and push actions require an explicit user click.
- Push is disabled for detached HEAD or repositories without a remote.
- Undo uses `git reset --soft HEAD~1`, keeping changes staged for revision.

## Development

```bash
npm install
npm run compile
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run package
```

The package command builds the extension and creates a `.vsix` file for local install or marketplace publishing.

## Project Layout

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
```

## Non-Goals

- Autonomous commits or pushes
- Sending whole repositories to an AI model
- Editing your source files
- Replacing pull request descriptions or release notes

## License

MIT
