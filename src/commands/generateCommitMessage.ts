import * as vscode from "vscode";

import { getAiCommitSettings } from "../config/vscodeSettings";
import { openRouterTokenSecretKey } from "../config/settings";
import {
  collectDiffContext,
  detectLanguageHints,
  getBranchName,
  getRepositoryName
} from "../git/diffCollector";
import { GitService } from "../git/gitService";
import { buildCommitPrompt } from "../openrouter/commitPrompt";
import { OpenRouterClient } from "../openrouter/openRouterClient";
import { parseCommitResponse } from "../openrouter/responseParser";
import { showCommitReviewPanel } from "../ui/commitReviewPanel";
import { confirmAction, showInfo, showPlainError, showRetryableError } from "../ui/notifications";

export interface GenerateCommandDependencies {
  gitService?: GitService;
  openRouterClient?: OpenRouterClient;
}

export async function generateCommitMessage(
  context: vscode.ExtensionContext,
  dependencies: GenerateCommandDependencies = {}
): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    await showPlainError("Open a workspace folder before generating a commit message.");
    return;
  }

  const gitService = dependencies.gitService ?? new GitService();
  const openRouterClient = dependencies.openRouterClient ?? new OpenRouterClient();
  const settings = getAiCommitSettings();
  const token = await context.secrets.get(openRouterTokenSecretKey);

  if (!token) {
    const selected = await vscode.window.showWarningMessage(
      "CommitCraft needs an OpenRouter API token before it can generate commit messages.",
      "Set Token"
    );
    if (selected === "Set Token") {
      await vscode.commands.executeCommand("commitCraft.setOpenRouterToken");
    }
    return;
  }

  let shouldRetry = true;
  while (shouldRetry) {
    shouldRetry = false;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "CommitCraft: generating smart Git commit",
        cancellable: false
      },
      async () => {
        try {
          if (!(await gitService.hasChanges(workspacePath))) {
            await showInfo("No Git changes found.");
            return;
          }

          const diffContext = await collectDiffContext(workspacePath, {
            includeUntrackedFiles: settings.includeUntrackedFiles,
            maxDiffCharacters: settings.maxDiffCharacters
          });

          if (diffContext.diff.trim().length === 0 || diffContext.files.length === 0) {
            await showPlainError("No safe text changes are available to summarize.");
            return;
          }

          const [repositoryName, branchName, languageHints, hasStagedChanges, pushReadiness] =
            await Promise.all([
              getRepositoryName(workspacePath),
              getBranchName(workspacePath),
              detectLanguageHints(diffContext.files),
              gitService.hasStagedChanges(workspacePath),
              gitService.getPushReadiness(workspacePath)
            ]);
          const prompt = buildCommitPrompt({
            repositoryName,
            branchName,
            diff: diffContext.diff,
            diffSource: diffContext.diffSource,
            files: diffContext.files,
            languageHints,
            stats: diffContext.stats,
            truncated: diffContext.truncated
          });
          const aiResponse = await openRouterClient.generateCommitMessage({
            token,
            model: settings.openRouterModel,
            fallbackModel: settings.fallbackModel,
            prompt
          });
          const parsed = parseCommitResponse(aiResponse.content);

          const panel = showCommitReviewPanel(
            {
              message: parsed.message,
              modelUsed: aiResponse.modelUsed,
              diffContext,
              recovered: parsed.recovered,
              recoveryReason: parsed.recoveryReason,
              canPush: pushReadiness.canPush,
              pushDisabledReason: pushReadiness.canPush ? undefined : pushReadiness.reason,
              showCommitAndPush: settings.showCommitAndPush
            },
            {
              commit: async (message) => {
                await commitReviewedMessage(
                  gitService,
                  workspacePath,
                  message,
                  diffContext.files,
                  hasStagedChanges
                );
              },
              push: async () => {
                await pushWithConfirmation(gitService, workspacePath);
              },
              commitAndPush: async (message) => {
                const committed = await commitReviewedMessage(
                  gitService,
                  workspacePath,
                  message,
                  diffContext.files,
                  hasStagedChanges
                );
                if (committed) {
                  await pushWithConfirmation(gitService, workspacePath);
                }
              }
            }
          );
          context.subscriptions.push(panel);
        } catch (error) {
          const retry = await showRetryableError(formatError(error));
          if (retry === "Retry") {
            shouldRetry = true;
          }
        }
      }
    );
  }
}

function getWorkspacePath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.fsPath;
}

async function commitReviewedMessage(
  gitService: GitService,
  workspacePath: string,
  message: string,
  files: string[],
  hasStagedChanges: boolean
): Promise<boolean> {
  const normalized = message.trim();
  if (normalized.length === 0) {
    await showPlainError("Commit message cannot be empty.");
    return false;
  }

  const action = hasStagedChanges ? "Commit Staged Changes" : "Stage and Commit";
  const prompt = hasStagedChanges
    ? "Commit the currently staged changes with this message?"
    : "Stage the reviewed safe files and commit them with this message?";

  if (!(await confirmAction(prompt, action))) {
    return false;
  }

  await gitService.commit({
    workspacePath,
    message: normalized,
    filesToStage: files,
    stageFilesBeforeCommit: !hasStagedChanges
  });
  await showInfo("Commit created.");
  return true;
}

async function pushWithConfirmation(gitService: GitService, workspacePath: string): Promise<void> {
  const readiness = await gitService.getPushReadiness(workspacePath);
  if (!readiness.canPush) {
    await showPlainError(readiness.reason ?? "This branch cannot be pushed.");
    return;
  }

  if (
    !(await confirmAction(
      `Push ${readiness.branchName} to ${readiness.remoteName ?? "origin"}?`,
      "Push"
    ))
  ) {
    return;
  }

  await gitService.push(workspacePath);
  await showInfo("Branch pushed.");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
