# Manual QA Checklist

Use this checklist in a VS Code Extension Development Host before packaging or publishing.

## Setup

1. Run `npm install`.
2. Run `npm run compile`.
3. Press `F5` in VS Code or use the generated extension host from your launch configuration.
4. Open a Git repository with local changes.
5. Run `CommitCraft: Open Commit Assistant` and enter a valid OpenRouter API key if prompted.

## Core Flow

- Run `CommitCraft: Open Commit Assistant` from the Command Palette, Source Control action, or status bar.
- Confirm the assistant opens a changed-file preview before any OpenRouter request is made.
- Confirm safe changed files can be selected or unselected before generation.
- Confirm excluded files are shown with reasons.
- Click `Generate Message` to create the draft commit message.
- Confirm staged changes are preferred when staged changes exist.
- Confirm unstaged changes are summarized when nothing is staged.
- Confirm the review panel shows summary, description, files changed, lines added, lines removed, affected files, model used, diff source, and risk.
- Edit the commit message in the review panel and confirm the edited text is what gets committed.
- Click `Commit` and confirm no commit happens until the confirmation modal is accepted.
- Click `Push` and confirm no push happens until the confirmation modal is accepted.
- Confirm `Commit and Push` is available when a remote/branch can be pushed.

## Safety Checks

- Remove the OpenRouter token and confirm the assistant offers token setup, then continues after a token is saved.
- Use an invalid token and confirm the OpenRouter error is shown in plain language with a retry action.
- Create a large diff above `commitCraft.maxDiffCharacters` and confirm the review panel shows a truncation warning.
- Add `.env`, binary, secret-like, and lockfile changes and confirm they are excluded from the prompt context.
- Use a repository with no changes and confirm a clear no-change message appears.
- Use a repository with no remote and confirm push is disabled or explained.
- Check detached HEAD behavior and confirm push is blocked with a plain-language message.

## Release Gate

- `npm test`
- `npm run compile`
- `npm run lint`
- `npm run format:check`
- `npm run vscode:test`
- `npm run package`
