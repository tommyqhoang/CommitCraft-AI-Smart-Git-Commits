# Repository Guidelines

## Project Structure & Module Organization

This repository is `CommitCraft-AI-Smart-Git-Commits`, a TypeScript VS Code extension for generating commit messages, showing simple Git change stats, and committing or pushing with confirmation. Keep source under `src/`:

- `src/extension.ts` for activation and command registration.
- `src/commands/` for VS Code command handlers.
- `src/git/` for diff collection, change stats, commit, push, and remote logic. `changeStats.ts` owns total files changed, lines added, and lines removed.
- `src/openrouter/` for API calls, prompt creation, and response parsing.
- `src/ui/` for review panels, notifications, and user confirmations.
- `src/config/` for settings and secure token access.
- `src/test/` for unit and extension tests.

Keep icons and marketplace media in `assets/`.

## Build, Test, and Development Commands

Use these npm scripts:

- `npm install` installs dependencies.
- `npm run compile` type-checks and builds.
- `npm run watch` runs TypeScript in watch mode.
- `npm test` runs the automated test suite.
- `npm run lint` checks code quality.
- `npm run format` formats source and docs.

## Coding Style & Naming Conventions

Use TypeScript strict mode, small focused files, 2-space indentation, `camelCase` for variables/functions, `PascalCase` for classes and types, and descriptive command names such as `generateCommitMessage`.

Use ESLint and Prettier. Do not commit build output, secrets, `.env` files, or local VS Code state.

## Testing Guidelines

Use Vitest for unit tests and VS Code extension tests for command registration and extension-host behavior. Name tests after the module, for example `responseParser.test.ts`.

Cover prompt building, OpenRouter response parsing, diff filtering, change-stat calculation, config loading, no-change states, and error handling.

## Commit & Pull Request Guidelines

The current history only contains an initial commit, so use the convention in `README.md`:

```text
<type>: <short summary>
```

Allowed types include `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, and `ci`.

Pull requests should include a concise description, testing performed, screenshots or recordings for UI changes, and any linked issue. Call out changes affecting tokens, Git operations, or OpenRouter request content.

## Security & Configuration Tips

Store OpenRouter API tokens only in VS Code `SecretStorage`. Never log tokens or send ignored files, binary content, `.env` files, or obvious secrets to OpenRouter. Commit and push actions must always require explicit user confirmation.
