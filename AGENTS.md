# Repository Guidelines

## Project Structure & Module Organization

This repository is `CommitCraft-AI-Smart-Git-Commits`, a TypeScript VS Code extension for generating commit messages, showing simple Git change stats, and committing or pushing with confirmation. Keep source under `src/`:

- `src/extension.ts` for activation and command registration.
- `src/commands/` for VS Code command handlers and workspace resolution.
- `src/git/` for diff collection, file safety filtering, change stats, commit, push, and remote logic. `changeStats.ts` owns total files changed, lines added, and lines removed.
- `src/openrouter/` for API calls, prompt creation, and response parsing.
- `src/ui/` for assistant webview rendering, review panels, notifications, and user confirmations.
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

Allowed types include `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `style`, `perf`, and `revert`.

Pull requests should include a concise description, testing performed, screenshots or recordings for UI changes, and any linked issue. Call out changes affecting tokens, Git operations, or OpenRouter request content.

## Security & Configuration Tips

Store OpenRouter API tokens only in VS Code `SecretStorage`. Never log tokens or send ignored files, binary content, `.env` files, or obvious secrets to OpenRouter. Commit and push actions must always require explicit user confirmation.

<claude-mem-context>
# Memory Context

# [ai-commit] recent context, 2026-05-13 11:10pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (9,266t read) | 583,558t work | 98% savings

### May 13, 2026
S94 Update project logo and verify package.json configuration (May 13 at 6:32 PM)
S95 Run test suite to verify push-related functionality and identify any regressions after adding push edge case tests. (May 13 at 6:50 PM)
S96 Audit-Fix Completion and Progress Summary (May 13 at 9:16 PM)
S97 Error Handling Design Brainstorm and Recommendation (May 13 at 9:25 PM)
S98 Error Handling Design Implementation Progress (May 13 at 9:27 PM)
S99 Error Handling Layer-by-Layer Design Review (May 13 at 9:29 PM)
S100 Error Handling Design — Three Sections Complete (May 13 at 9:29 PM)
S101 CommitCraft AI extension — quality gate pass and configuration hardening (May 13 at 9:32 PM)
2052 10:11p 🔴 Fix: use typed error hierarchy throughout git operations
S102 Session started (May 13 at 10:17 PM)
2060 10:21p 🔵 No active work session detected
2061 10:22p 🔵 Read package.json
2062 " ✅ Package version bumped to 0.3.1
2063 10:23p 🟣 Push button disabled state logic implemented
2064 " 🔵 Push readiness logic in gitService.ts
2067 10:26p 🔵 Read commitPrompt.ts
2068 " 🔵 Read settings.ts
2069 " 🔵 Commit assistant UI event wiring and rendering logic
S103 Propose implementation of UI improvements for the commit assistant extension (May 13 at 10:27 PM)
2094 10:45p ✅ Codebase directory structure and file inventory
2096 " 🟣 Commit Review Panel UI Coverage Tests
2097 10:46p 🟣 Panel Handlers Test Refactor
2098 " 🔵 Coverage threshold not met
2099 " 🔵 extension.ts has 0% test coverage
2100 " 🔵 Coverage gap analysis — files requiring additional tests
2101 10:47p 🔵 GitService test infrastructure analysis
2102 " 🟣 VS Code mocks updated for test stability
2103 " 🔴 VS Code extension test suite enhanced
2105 10:48p 🔴 OpenRouterClient test suite enhanced
2106 " 🔴 WorkspaceResolver test suite enhanced
2108 " 🔴 gitServiceErrors test helper updated
2109 10:49p 🔴 gitServiceErrors test refactored to use promisified execFile
2110 " 🔴 gitServiceErrors test updated to use util.promisify
2111 " 🔴 gitService.ts classifyPushError improved
2112 " 🔴 gitService.ts classifyPushError improved
2114 10:50p 🔴 responseParser.ts uncovered lines
2115 " 🔴 responseParser.test.ts enhanced with coverage tests
2117 10:51p 🔴 responseParser.test.ts updated for null JSON
2118 " 🔴 Coverage still below thresholds after test additions
2119 " 🔴 commitPrompt.test.ts added fallback test
2121 10:52p 🔴 GitService getUnpushedCommitCount test failing
2122 " 🔴 GitService coverage test failing
2123 " 🔴 generateCommitMessage.test.ts added error handling tests
2124 " 🔴 generateCommitMessage.test.ts enhanced with NetworkError handling tests
2125 " 🔴 generateCommitMessage.test.ts successful execution
2127 10:53p 🔴 eslint.config.js partial content revealed
2128 " 🔴 eslint.config.js updated to ignore coverage directory
2129 10:54p 🔴 TypeScript compilation completed successfully
2130 " 🔴 .prettierignore file not found
2131 " 🔴 .vscodeignore updated with additional ignore patterns
2137 10:57p 🔴 diffCollector.ts: improved untracked file safety checks
2138 " 🔴 diffCollector.ts: partial patch application
2154 11:06p 🟣 New Feature Implemented
2155 11:07p 🔵 claude-mem version mismatch and runtime not set up
2156 " 🔵 Extension Host Execution Logged
2157 11:08p 🔵 GitHub Actions CI Fix Skill Documented
2158 " ✅ CI/CD Workflow Configuration for Test & Coverage
2159 11:09p 🟣 TypeScript Compilation Pipeline Added
2160 " 🔵 Go Development Environment Detected
2162 " ✅ Slack Notification Environment Variable Updated

Access 584k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
