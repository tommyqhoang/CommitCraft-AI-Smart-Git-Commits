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

# [ai-commit] recent context, 2026-05-13 8:03am CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (9,941t read) | 581,668t work | 98% savings

### May 12, 2026

S85 Publisher ID mismatch resolution for VS Code Marketplace extension publication (May 12 at 11:22 PM)
S86 Fix missing icon and conditional button rendering in VS Code extension (May 12 at 11:39 PM)

### May 13, 2026

1839 7:22a ✅ Extracted maxDiffCharacters logic into readDiffLimit helper
1841 " ✅ Added configurable timeout to OpenRouterClient
1844 7:23a ✅ Fixed test timing issue in openRouterClient.test.ts
1861 7:31a 🟣 UI Enhancements for Commitcraft
1862 " 🔄 UI Line Styling Improvements
1863 " 🟣 Enhanced Commit Assistant UI
1864 " 🔴 Missing UI Class Implementations
1865 7:32a 🔄 Commit Assistant UI Overhaul
1866 7:33a 🔄 Code Formatting Applied
1867 " 🔴 VS Code Extension Tests Executed
1869 7:38a 🟣 Commit view enhanced to show scrollable descriptions
1870 " 🟣 Test added for separate summary and description fields in commit assistant
1871 7:39a 🟣 Commit assistant UI split into separate summary and description fields
1872 " ✅ Code formatted with Prettier
1873 " 🔵 Formatting issues detected in AGENTS.md
1874 7:42a 🔵 Systematic Debugging Methodology Documented
1875 " 🟣 Tests added for committed state and undo commit functionality
1876 " 🟣 GitService test added for undo commit functionality
1877 7:44a 🔵 Mismatch between test expectations and current implementation
1878 " 🔵 Committed state UI implementation with commit hash and undo functionality
1879 7:45a 🟣 GitService implementation for commit state management
1880 " 🔵 Test suite for commit review panel and GitService passes
1881 " 🟣 Code formatting and linting applied to key files
1885 7:46a 🔵 References to commit review panel and undo commit identified in codebase
1886 " 🔵 CommitAssistantHtml source reveals UI rendering logic and undoCommit integration
1888 7:48a 🔵 GitService implementation details
1889 " 🔴 CommitReviewPanel test file analysis
1890 7:49a 🔴 commitAssistantHtml.ts updates
1891 7:50a 🔴 commitAssistantHtml.ts updates
1892 " 🔴 generateCommitMessage.ts enhancements
1893 7:51a 🔴 commitReviewPanel.test.ts updates
1894 " 🔴 commitAssistantHtml.ts updates: pending push panel and button
1895 7:52a 🔴 generateCommitMessage.ts patch applied
1897 " 🔴 Test suite validation
1898 7:53a 🔴 VS Code extension test suite passed
1899 7:54a 🔴 SKILL.md content retrieved
1900 " 🔴 commitAssistantHtml.ts UI refinement
1901 " 🔴 Test Passage Confirmation
1902 7:55a 🔴 Full test suite passed
1903 " 🔴 Prettier formatting verification
1904 " 🔴 Post-formatting test validation
1905 " 🔴 VSIX package checksum verification
1906 7:56a 🔴 CommitAssistant HTML rendering verification
1907 7:57a 🔴 Test suite extension pending implementation
1908 " 🔴 CommitAssistant UI Test Patch Verification
1909 " 🔴 Post-patch test and compilation validation
1910 7:58a 🔴 CommitAssistant UI Patch Validation
1911 " 🔴 Full test suite validation after commit message generator patch
1912 7:59a 🔴 VS Code extension integration test validation
1913 8:02a 🟣 API Key Integration

Access 582k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
