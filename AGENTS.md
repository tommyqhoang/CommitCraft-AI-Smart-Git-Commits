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

# [ai-commit] recent context, 2026-05-13 7:38am CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (9,040t read) | 758,321t work | 99% savings

### May 12, 2026

S85 Publisher ID mismatch resolution for VS Code Marketplace extension publication (May 12 at 11:22 PM)
1783 11:28p 🔵 Read package.json Settings
1784 " ✅ Added Comment to showCommitAndPush Setting
1785 " 🔵 Verified commitReviewedMessage Return Type
1786 11:29p 🔴 Configuration Validation Result
1787 " 🔴 Code Fix Summary
1790 11:37p 🔵 MCP plugin context-mode batch execute tool located
1791 " 🔴 VS Code extension icon file missing from assets directory
1793 " 🔵 Icon files exist and are properly configured
1794 11:38p 🔴 Missing icon file created for VS Code extension
1795 " 🔵 VS Code extension commit message generation workflow
1796 " 🔵 .vscodeignore does not exclude assets directory
1797 11:39p 🔴 Conditional display of Commit & Push button added
S86 Fix missing icon and conditional button rendering in VS Code extension (May 12 at 11:39 PM)

### May 13, 2026

1798 6:51a 🔵 Project structure discovered for ai-commit VS Code extension
1799 " 🔵 VS Code extension activation and command registration
1800 " 🔵 Manual QA checklist for CommitCraft extension
1801 6:52a 🔵 Brainstorming skill documentation reviewed
1802 6:53a 🔵 Writing-plans skill documentation reviewed
1803 " 🔵 Extension test suite verifies command registration
1804 6:54a 🔵 VS Code extension test failure
1805 " 🔵 setOpenRouterToken.ts modified to return boolean
1806 6:55a 🔵 README.md updated with new assistant workflow and status bar entry
1807 6:56a 🔵 package.json reveals extension activation and command IDs
1809 " 🔵 VS Code extension test now passes
1810 " 🔵 VSIX package created successfully
1811 6:57a 🔵 CommitCraft command IDs and references validated
1812 6:59a 🔵 Brainstorming skill documentation loaded
1813 7:00a 🔴 OpenRouterClient implementation details
1815 7:02a 🔵 New test file created for commitReviewPanel
1816 7:03a 🔵 Commit Assistant UI component created
1818 7:04a 🔵 commitReviewPanel.ts file deleted
1819 7:05a 🔵 gitService.ts updated
1820 " 🔵 settings.test.ts updated
1822 " 🔵 settings.ts updated
1832 7:13a 🔵 User unable to access installed extension for commit generation
1833 7:18a 🔵 [ **title**: Systematic debugging methodology documentation read ]
1834 7:19a ✅ [ **title**: Local tests executed ]
1835 " ✅ [ **title**: generateCommitMessage.ts code reviewed ]
1836 " 🔵 OpenRouter client code reviewed
1837 7:20a 🔴 Process still running
1838 7:21a ✅ Added oversized file handling to diffCollector
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

Access 758k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
