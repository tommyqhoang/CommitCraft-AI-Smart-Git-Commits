import * as vscode from "vscode";

import { getAiCommitSettings } from "../config/vscodeSettings";
import { openRouterTokenSecretKey } from "../config/settings";
import { setOpenRouterToken } from "./setOpenRouterToken";
import { selectWorkspacePath } from "./workspaceResolver";
import {
  collectDiffContext,
  detectLanguageHints,
  filterDiffContextToFiles,
  type DiffContext,
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

          const [hasStagedChanges, pushReadiness] = await Promise.all([
            gitService.hasStagedChanges(workspacePath),
            gitService.getPushReadiness(workspacePath)
          ]);
          let generatedDiffContext: DiffContext | undefined;

          const panel = showCommitReviewPanel(
            {
              diffContext,
              canPush: pushReadiness.canPush,
              pushDisabledReason: pushReadiness.canPush ? undefined : pushReadiness.reason,
              recovered: false
            },
            {
              generate: async (files) => {
                const selectedDiffContext = filterDiffContextToFiles(diffContext, files);
                if (
                  selectedDiffContext.diff.trim().length === 0 ||
                  selectedDiffContext.files.length === 0
                ) {
                  throw new Error("Select at least one safe changed file to summarize.");
                }

                const token = await getOrPromptForToken(context);
                if (!token) {
                  throw new Error("Add an OpenRouter API key to generate a commit message.");
                }

                const [repositoryName, branchName, languageHints] = await Promise.all([
                  getRepositoryName(workspacePath),
                  getBranchName(workspacePath),
                  detectLanguageHints(selectedDiffContext.files)
                ]);
                const prompt = buildCommitPrompt({
                  repositoryName,
                  branchName,
                  diff: selectedDiffContext.diff,
                  diffSource: selectedDiffContext.diffSource,
                  files: selectedDiffContext.files,
                  languageHints,
                  stats: selectedDiffContext.stats,
                  truncated: selectedDiffContext.truncated
                });
                const aiResponse = await vscode.window.withProgress(
                  {
                    location: vscode.ProgressLocation.Notification,
                    title: "CommitCraft: generating smart Git commit",
                    cancellable: false
                  },
                  () =>
                    openRouterClient.generateCommitMessage({
                      token,
                      model: settings.openRouterModel,
                      fallbackModel: settings.fallbackModel,
                      prompt
                    })
                );
                const parsed = parseCommitResponse(aiResponse.content);
                generatedDiffContext = selectedDiffContext;

                return {
                  message: parsed.message,
                  modelUsed: aiResponse.modelUsed,
                  diffContext: selectedDiffContext,
                  recovered: parsed.recovered,
                  recoveryReason: parsed.recoveryReason,
                  canPush: pushReadiness.canPush,
                  pushDisabledReason: pushReadiness.canPush ? undefined : pushReadiness.reason
                };
              },
              commit: async (message) => {
                await commitReviewedMessage(
                  gitService,
                  workspacePath,
                  message,
                  getGeneratedFiles(generatedDiffContext),
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
                  getGeneratedFiles(generatedDiffContext),
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
  return selectWorkspacePath({
    workspaceFolders: vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
    activeDocumentPath: vscode.window.activeTextEditor?.document.uri.fsPath
  });
}

async function getOrPromptForToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  let token = await context.secrets.get(openRouterTokenSecretKey);

  if (!token) {
    const selected = await vscode.window.showWarningMessage(
      "CommitCraft needs your OpenRouter API key once before it can generate commit messages.",
      "Add API Key"
    );
    if (selected === "Add API Key") {
      const saved = await setOpenRouterToken(context);
      if (saved) {
        token = await context.secrets.get(openRouterTokenSecretKey);
      }
    }
  }

  return token;
}

function getGeneratedFiles(generatedDiffContext: DiffContext | undefined): string[] {
  if (!generatedDiffContext) {
    throw new Error("Generate a commit message before committing.");
  }

  return generatedDiffContext.files;
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
