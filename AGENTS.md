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

# [ai-commit] recent context, 2026-05-13 10:45pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (10,004t read) | 652,310t work | 98% savings

### May 13, 2026

1979 2:44p ✅ feat: add undo button to preview view when commits are unpushed
1980 6:31p 🟣 Developer Experience Enhancement Features
S94 Update project logo and verify package.json configuration (May 13 at 6:32 PM)
1981 6:34p 🔴 App store logo updated to new logo
1982 6:49p 🟣 New Logo Implemented
1983 " ✅ Logo Asset Replaced
1984 6:50p 🔵 Package.json Icon Configuration Found
S95 Run test suite to verify push-related functionality and identify any regressions after adding push edge case tests. (May 13 at 6:50 PM)
1985 6:58p 🔵 No observable session activity detected
1986 " 🔵 Audit-fix workflow definition documented
1988 6:59p 🔵 Project structure mapped - 25 TypeScript source files identified
1989 7:00p 🔵 Commit review panel UI implementation
1990 " 🔵 Generate commit message command implementation
1991 7:03p 🔴 Response parser test suite validates commit message recovery logic
1992 7:04p 🔴 gitService commit method updated
1993 7:05p 🔵 Commit message recovery logic enhanced
1994 " 🔵 Commit review panel now accepts workspacePath parameter
1995 8:57p 🔵 Current version and scripts baseline established
1996 8:58p ✅ Version updated to 0.3.0 in package.json
1997 9:08p 🔴 Push operation silent failure resolved
1998 " 🔵 **Missing gitService.ts file during push reference search**
1999 " 🔵 **Push implementation located in git/gitService.ts with readiness checks**
2001 9:10p 🔵 Notification System Implementation
2002 9:11p 🔵 Commit Review Panel Test Suite
2003 9:14p 🔵 Existing Push Test Covers Only Happy Path
2004 9:15p 🔵 Push Edge Case Tests Added to gitService.test.ts
2005 " 🔵 Commit Review Panel Test Suite Expanded
2006 9:16p 🔵 Test Suite Results: One Push Banner Test Fails
S96 Audit-Fix Completion and Progress Summary (May 13 at 9:16 PM)
2007 9:18p 🔵 Audit-Fix Workflow Pipeline
2008 " 🔵 Source Code File Inventory
2009 9:21p 🔵 VS Code Settings Configuration
2012 9:23p 🔵 Commit Assistant HTML Rendering Logic
2014 " 🔵 Commit Message Generation Logic
S97 Error Handling Design Brainstorm and Recommendation (May 13 at 9:25 PM)
S98 Error Handling Design Implementation Progress (May 13 at 9:27 PM)
S99 Error Handling Layer-by-Layer Design Review (May 13 at 9:29 PM)
S100 Error Handling Design — Three Sections Complete (May 13 at 9:29 PM)
S101 CommitCraft AI extension — quality gate pass and configuration hardening (May 13 at 9:32 PM)
2041 9:50p 🔴 Push notification pipeline enhanced with error handling and retry logic
2042 " ✅ Read generateCommitMessage.ts with limit 50
2043 " 🔴 Return createdPanel from generateCommitMessage
2044 9:51p 🔵 Test suite passed successfully
2045 " 🔴 Singleton panel pattern and UserInputError fix
2046 10:07p ⚖️ Codebase scan initiated for critical issue resolution
2047 " 🔵 Custom error hierarchy defined in errors.ts
2048 " 🔵 Configuration settings interface and reader defined
2049 " 🔵 GitService test suite defines comprehensive repository operations
2050 10:10p 🔵 Commit review panel rendering tests defined
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
**Investigated**: Identified pain points in the commit assistant UI and proposed features to address them

**Learned**: Understood the current limitations of the commit assistant UI and the user's expectations for a better experience

**Completed**: Proposed four specific UI improvements: live char counter, regenerate button, copy button, and a setting to skip commit confirmation

**Next Steps**: Discussing the proposed implementation of the four UI improvements

Access 652k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
