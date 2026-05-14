import * as vscode from "vscode";

import { getAiCommitSettings } from "../config/vscodeSettings";
import { collectDiffContext, type DiffContext } from "../git/diffCollector";
import { GitService } from "../git/gitService";
import { OpenRouterClient } from "../openrouter/openRouterClient";
import { showCommitReviewPanel } from "../ui/commitReviewPanel";
import { CommitCraftError } from "../errors";
import { showInfo, showPlainError, showRetryableError } from "../ui/notifications";
import { CommitSession } from "./commitSession";
import { selectWorkspacePath } from "./workspaceResolver";

export interface GenerateCommandDependencies {
  gitService?: GitService;
  openRouterClient?: OpenRouterClient;
}

export async function generateCommitMessage(
  context: vscode.ExtensionContext,
  dependencies: GenerateCommandDependencies = {}
): Promise<vscode.WebviewPanel | undefined> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    await showPlainError("Open a workspace folder before generating a commit message.");
    return undefined;
  }

  const gitService = dependencies.gitService ?? new GitService();
  const openRouterClient = dependencies.openRouterClient ?? new OpenRouterClient();
  const settings = getAiCommitSettings();

  let createdPanel: vscode.WebviewPanel | undefined;
  let shouldRetry = true;

  while (shouldRetry) {
    shouldRetry = false;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "CommitCraft: loading changed files",
        cancellable: false
      },
      async () => {
        try {
          const [hasChanges, initialUnpushedCommitCount] = await Promise.all([
            gitService.hasChanges(workspacePath),
            gitService.getUnpushedCommitCount(workspacePath)
          ]);

          if (!hasChanges && initialUnpushedCommitCount === 0) {
            await showInfo("No Git changes found.");
            return;
          }

          const currentDiffContext = hasChanges
            ? await collectDiffContext(workspacePath, {
                includeUntrackedFiles: settings.includeUntrackedFiles,
                maxDiffCharacters: settings.maxDiffCharacters
              })
            : createEmptyDiffContext();

          if (
            initialUnpushedCommitCount === 0 &&
            (currentDiffContext.diff.trim().length === 0 ||
              currentDiffContext.files.length === 0) &&
            currentDiffContext.excludedFiles.length === 0
          ) {
            await showPlainError("No safe text changes are available to summarize.");
            return;
          }

          const pushReadiness = await gitService.getPushReadiness(workspacePath);
          const session = new CommitSession(
            { gitService, openRouterClient, context, settings, workspacePath },
            currentDiffContext
          );

          const panel = showCommitReviewPanel(
            {
              diffContext: currentDiffContext,
              canPush: pushReadiness.canPush,
              pushDisabledReason: pushReadiness.canPush ? undefined : pushReadiness.reason,
              recovered: false,
              pendingPushCount: initialUnpushedCommitCount,
              canReviewChanges: hasChanges && currentDiffContext.files.length > 0,
              activityHistory: [...session.activityHistory],
              commitState:
                initialUnpushedCommitCount > 0 && currentDiffContext.files.length === 0
                  ? {
                      status: "pendingPush",
                      commitHash: await gitService
                        .getHeadShortHash(workspacePath)
                        .catch(() => undefined)
                    }
                  : undefined
            },
            {
              generate: (files) => session.generate(files),
              regenerate: () => session.regenerate(),
              commit: (message) => session.commit(message),
              push: () => session.push(),
              commitAndPush: (message) => session.commitAndPush(message),
              undoCommit: () => session.undoCommit(),
              reviewChanges: () => session.reviewChanges()
            },
            workspacePath
          );

          createdPanel = panel;
          context.subscriptions.push(panel);
        } catch (error) {
          const retry = await showRetryableError(
            error instanceof CommitCraftError
              ? error.userMessage
              : error instanceof Error
                ? error.message
                : String(error)
          );
          if (retry === "Retry") {
            shouldRetry = true;
          }
        }
      }
    );
  }

  return createdPanel;
}

function getWorkspacePath(): string | undefined {
  return selectWorkspacePath({
    workspaceFolders: vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
    activeDocumentPath: vscode.window.activeTextEditor?.document.uri.fsPath
  });
}

function createEmptyDiffContext(): DiffContext {
  return {
    diff: "",
    fullDiff: "",
    diffSource: "unstaged",
    files: [],
    excludedFiles: [],
    fileStats: {},
    stats: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 },
    truncated: false,
    warnings: [],
    maxDiffCharacters: 0
  };
}
