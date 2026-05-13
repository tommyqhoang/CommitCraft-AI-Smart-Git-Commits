# CommitCraft-AI-Smart-Git-Commits

CommitCraft-AI-Smart-Git-Commits is a simple Visual Studio Code extension for turning local code changes into clear Git commits. It reviews the current Git diff, uses OpenRouter to draft a commit summary and description, then lets the user commit and push to GitHub from a polished VS Code UI.

The goal is not to replace developer judgment. The extension should make the commit workflow faster, clearer, and safer while keeping the user in control before anything is committed or pushed.

## Core Features

- Generate a smart commit summary from the current Git diff.
- Generate a longer commit description explaining the intent and important changes.
- Show simple change stats before commit: total files changed, total lines added, and total lines removed.
- Let the user review and edit the generated commit message before committing.
- Commit selected changes or all staged changes through VS Code's Git integration.
- Push the current branch to GitHub after a successful commit.
- Support OpenRouter API tokens through VS Code settings or secure secret storage.
- Default to `openrouter/auto`, with an easy option to use `openrouter/free`.
- Keep the workflow simple: review changes, generate message, commit, push.

## User Experience

CommitCraft-AI-Smart-Git-Commits should feel like a native VS Code tool.

The main workflow should be available from:

- Source Control view action button.
- Command Palette command: `CommitCraft: Generate Smart Git Commit`.
- Optional status bar item when the workspace has Git changes.

Recommended flow:

1. User opens a Git workspace with local changes.
2. User clicks **Generate Smart Git Commit**.
3. Extension reads the current Git diff.
4. Extension sends a compact prompt to OpenRouter.
5. UI displays:
   - commit summary
   - commit description
   - total files changed
   - total lines added
   - total lines removed
   - affected files
   - model used
   - token/error status when relevant
6. User edits the message if needed.
7. User clicks **Commit**.
8. User clicks **Push** or enables **Commit and Push** for a one-step finish.

The extension must always ask for user confirmation before committing or pushing.

## OpenRouter Configuration

The extension will call OpenRouter's chat completions API.

Recommended defaults:

```json
{
  "commitCraft.openRouterModel": "openrouter/auto",
  "commitCraft.fallbackModel": "openrouter/free",
  "commitCraft.maxDiffCharacters": 60000,
  "commitCraft.includeUntrackedFiles": true,
  "commitCraft.autoPushAfterCommit": false
}
```

Token handling:

- Prefer VS Code `SecretStorage` for the OpenRouter API token.
- Never store API tokens in the workspace.
- Never log API tokens.
- Provide a command: `CommitCraft: Set OpenRouter API Token`.
- Provide a command: `CommitCraft: Clear OpenRouter API Token`.

## Commit Message Style

Generated messages should be concise, useful, and editable.

Default format:

```text
<type>: <short summary>

<description>
```

Examples:

```text
feat: add OpenRouter-powered commit generation

Adds the extension command, diff collection, and commit message generation flow.
The user can review the generated summary and description before committing.
```

Recommended commit types:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `build`
- `ci`

The AI should choose the type based on the diff. If the change is mixed, it should prefer the most user-visible intent.

## Prompting Requirements

The prompt should be deterministic and focused on commit quality.

The model should receive:

- repository name
- branch name
- staged diff when available
- unstaged diff when no staged diff exists
- list of changed files
- total files changed, lines added, and lines removed
- project language hints when cheap to detect

The model should return structured JSON:

```json
{
  "summary": "feat: add smart commit workflow",
  "description": "Adds the VS Code command, OpenRouter request flow, and commit review UI.",
  "riskLevel": "low",
  "changeStats": {
    "filesChanged": 2,
    "linesAdded": 120,
    "linesRemoved": 12
  },
  "notableFiles": ["src/extension.ts", "package.json"]
}
```

The extension should validate the response before showing it. If JSON parsing fails, it should fall back to a plain-text message and clearly mark that the response was recovered.

## Safety Rules

CommitCraft-AI-Smart-Git-Commits must be safe by default.

- Do not commit without an explicit user action.
- Do not push without an explicit user action.
- Do not send ignored files, secrets, `.env` files, or binary file contents to OpenRouter.
- Respect `.gitignore`.
- Prefer staged changes. If nothing is staged, explain that the extension will summarize unstaged changes.
- Warn when the diff is truncated because it exceeds `commitCraft.maxDiffCharacters`.
- Show OpenRouter errors in plain language with a retry option.
- Handle missing Git, missing remote, detached HEAD, and no-change states gracefully.

## Architecture

Implementation stack:

- TypeScript
- VS Code Extension API
- VS Code Git extension API where possible
- Native `fetch` for OpenRouter requests
- ESLint and Prettier for code quality
- Vitest or VS Code extension tests for unit coverage

Current structure:

```text
CommitCraft-AI-Smart-Git-Commits/
  src/
    extension.ts
    commands/
      generateCommitMessage.ts
      setOpenRouterToken.ts
      clearOpenRouterToken.ts
    git/
      gitService.ts
      diffCollector.ts
      changeStats.ts
    openrouter/
      openRouterClient.ts
      commitPrompt.ts
      responseParser.ts
    ui/
      commitReviewPanel.ts
      notifications.ts
    config/
      settings.ts
    test/
      responseParser.test.ts
      commitPrompt.test.ts
  package.json
  tsconfig.json
  eslint.config.js
  README.md
```

Key boundaries:

- `git/` owns repository state, diffs, commits, and pushes.
- `openrouter/` owns API calls, prompting, and response parsing.
- `ui/` owns VS Code panels, commands, notifications, and user confirmation.
- `config/` owns extension settings and defaults.

## UI Principles

- Keep the interface compact and focused on the next action.
- Make generated text editable before commit.
- Use clear primary actions: **Generate**, **Commit**, **Push**, **Commit and Push**.
- Show file context without overwhelming the user.
- Make errors actionable.
- Avoid modal-heavy flows except for confirmation before commit and push.
- Match VS Code theme colors and accessibility expectations.

## Release Quality

Before release, the project should include:

- TypeScript strict mode.
- Linting.
- Formatting.
- Unit tests for prompt creation, response parsing, config loading, and diff filtering.
- Unit tests for change-stat calculation: files changed, lines added, and lines removed.
- Integration tests for command registration.
- Manual test checklist for the VS Code Extension Development Host.
- Clear marketplace-ready extension metadata.
- No hardcoded API tokens.
- No unfinished task markers or incomplete implementation paths in released code.

## Development

The repository now includes the TypeScript VS Code extension scaffold, strict type checking, Vitest unit tests, VS Code extension-host tests, ESLint, Prettier, and VSCE packaging.

Common commands:

```bash
npm install
npm run compile
npm test
npm run lint
npm run format:check
npm run vscode:test
npm run package
```

Manual release checks live in [`docs/MANUAL_QA.md`](docs/MANUAL_QA.md).

## Manual QA Checklist

- Generates a message for staged changes.
- Generates a message for unstaged changes when nothing is staged.
- Handles no changes with a clear message.
- Handles missing OpenRouter token with setup guidance.
- Handles invalid OpenRouter token with a useful error.
- Handles large diffs with truncation notice.
- Shows accurate totals for files changed, lines added, and lines removed.
- Does not include ignored files or obvious secret files in prompts.
- Commits only after confirmation.
- Pushes only after confirmation.
- Works in a repo with no remote by disabling push and explaining why.

## Non-Goals

- Fully autonomous commits.
- Fully autonomous pushes.
- Rewriting user code.
- Replacing pull request descriptions.
- Managing provider-specific pull request or issue workflows.

## License

This project is licensed under the MIT License.
