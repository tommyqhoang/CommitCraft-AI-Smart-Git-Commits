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
import { parseCommitResponse, type GeneratedCommitMessage } from "../openrouter/responseParser";
import type { CommitReviewData } from "../ui/commitReviewPanel";
import { showCommitReviewPanel } from "../ui/commitReviewPanel";
import type { ActivityHistoryItem } from "../ui/commitAssistantHtml";
import { CommitCraftError, NetworkError, UserInputError } from "../errors";
import { confirmAction, showInfo, showPlainError, showRetryableError } from "../ui/notifications";

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

          let currentDiffContext = hasChanges
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

          const [hasStagedChanges, pushReadiness] = await Promise.all([
            gitService.hasStagedChanges(workspacePath),
            gitService.getPushReadiness(workspacePath)
          ]);
          let generatedDiffContext: DiffContext | undefined;
          let generatedMessage: GeneratedCommitMessage | undefined;
          let generatedModelUsed: string | undefined;
          let generatedRecovered = false;
          let generatedRecoveryReason: string | undefined;
          const activityHistory: ActivityHistoryItem[] = [];

          const panel = showCommitReviewPanel(
            {
              diffContext: currentDiffContext,
              canPush: pushReadiness.canPush,
              pushDisabledReason: pushReadiness.canPush ? undefined : pushReadiness.reason,
              recovered: false,
              pendingPushCount: initialUnpushedCommitCount,
              canReviewChanges: hasChanges && currentDiffContext.files.length > 0,
              activityHistory,
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
              generate: async (files) => {
                const selectedDiffContext = filterDiffContextToFiles(currentDiffContext, files);
                if (
                  selectedDiffContext.diff.trim().length === 0 ||
                  selectedDiffContext.files.length === 0
                ) {
                  throw new UserInputError("Select at least one safe changed file to summarize.");
                }

                const token = await getOrPromptForToken(context);
                if (!token) {
                  throw new UserInputError("Add an OpenRouter API key to generate a commit message.");
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
                const aiResponse = await vscode.window
                  .withProgress(
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
                  )
                  .catch((err: unknown) => {
                    throw classifyNetworkError(err);
                  });
                const parsed = parseCommitResponse(aiResponse.content);
                generatedDiffContext = selectedDiffContext;
                generatedMessage = parsed.message;
                generatedModelUsed = aiResponse.modelUsed;
                generatedRecovered = parsed.recovered;
                generatedRecoveryReason = parsed.recoveryReason;

                const [freshPushReadiness, freshPendingPushCount] = await Promise.all([
                  gitService.getPushReadiness(workspacePath),
                  gitService.getUnpushedCommitCount(workspacePath)
                ]);

                return {
                  message: parsed.message,
                  modelUsed: aiResponse.modelUsed,
                  diffContext: selectedDiffContext,
                  recovered: parsed.recovered,
                  recoveryReason: parsed.recoveryReason,
                  canPush: freshPushReadiness.canPush,
                  pushDisabledReason: freshPushReadiness.canPush ? undefined : freshPushReadiness.reason,
                  pendingPushCount: freshPendingPushCount,
                  activityHistory
                };
              },
              commit: async (message) => {
                const currentHasStagedChanges = await gitService.hasStagedChanges(workspacePath);
                const committed = await commitReviewedMessage(
                  gitService,
                  workspacePath,
                  message,
                  getGeneratedFiles(generatedDiffContext),
                  currentHasStagedChanges
                );
                if (!committed) {
                  return undefined;
                }

                const data = await buildPostCommitData(
                  gitService,
                  workspacePath,
                  "committed",
                  getCurrentReviewData({
                    currentDiffContext,
                    generatedDiffContext,
                    generatedMessage,
                    generatedModelUsed,
                    generatedRecovered,
                    generatedRecoveryReason
                  })
                );
                activityHistory.push(
                  createActivityItem("commit", "Committed", message, data.commitState?.commitHash)
                );
                return {
                  ...data,
                  activityHistory
                };
              },
              push: async () => {
                const pushed = await pushWithConfirmation(gitService, workspacePath);
                if (!pushed.pushed) {
                  return undefined;
                }

                const data = await buildPostCommitData(
                  gitService,
                  workspacePath,
                  "pushed",
                  getCurrentReviewData({
                    currentDiffContext,
                    generatedDiffContext,
                    generatedMessage,
                    generatedModelUsed,
                    generatedRecovered,
                    generatedRecoveryReason
                  })
                );
                activityHistory.push(
                  createActivityItem(
                    "push",
                    "Pushed",
                    formatPushActivityDetail(pushed),
                    data.commitState?.commitHash
                  )
                );
                return {
                  ...data,
                  activityHistory
                };
              },
              commitAndPush: async (message) => {
                const currentHasStagedChanges = await gitService.hasStagedChanges(workspacePath);
                const committed = await commitReviewedMessage(
                  gitService,
                  workspacePath,
                  message,
                  getGeneratedFiles(generatedDiffContext),
                  currentHasStagedChanges
                );
                if (!committed) {
                  return undefined;
                }

                const generatedData = getCurrentReviewData({
                  currentDiffContext,
                  generatedDiffContext,
                  generatedMessage,
                  generatedModelUsed,
                  generatedRecovered,
                  generatedRecoveryReason
                });
                const pushed = await pushWithConfirmation(gitService, workspacePath);
                const data = await buildPostCommitData(
                  gitService,
                  workspacePath,
                  pushed.pushed ? "pushed" : "committed",
                  generatedData
                );
                activityHistory.push(
                  createActivityItem("commit", "Committed", message, data.commitState?.commitHash)
                );
                if (pushed.pushed) {
                  activityHistory.push(
                    createActivityItem(
                      "push",
                      "Pushed",
                      formatPushActivityDetail(pushed),
                      data.commitState?.commitHash
                    )
                  );
                }
                return {
                  ...data,
                  activityHistory
                };
              },
              undoCommit: async () => {
                const undone = await undoCommitWithConfirmation(gitService, workspacePath);
                if (!undone) {
                  return undefined;
                }
                activityHistory.push(
                  createActivityItem("undo", "Undid Commit", "Changes kept staged.")
                );

                currentDiffContext = await collectDiffContext(workspacePath, {
                  includeUntrackedFiles: settings.includeUntrackedFiles,
                  maxDiffCharacters: settings.maxDiffCharacters
                });
                generatedDiffContext = undefined;
                generatedMessage = undefined;
                generatedModelUsed = undefined;
                generatedRecovered = false;
                generatedRecoveryReason = undefined;

                const [nextPushReadiness, pendingPushCount] = await Promise.all([
                  gitService.getPushReadiness(workspacePath),
                  gitService.getUnpushedCommitCount(workspacePath)
                ]);

                return {
                  diffContext: currentDiffContext,
                  canPush: nextPushReadiness.canPush,
                  pushDisabledReason: nextPushReadiness.canPush
                    ? undefined
                    : nextPushReadiness.reason,
                  pendingPushCount,
                  canReviewChanges: currentDiffContext.files.length > 0,
                  activityHistory,
                  recovered: false
                };
              },
              reviewChanges: async () => {
                currentDiffContext = await collectDiffContext(workspacePath, {
                  includeUntrackedFiles: settings.includeUntrackedFiles,
                  maxDiffCharacters: settings.maxDiffCharacters
                });
                generatedDiffContext = undefined;
                generatedMessage = undefined;
                generatedModelUsed = undefined;
                generatedRecovered = false;
                generatedRecoveryReason = undefined;

                if (
                  currentDiffContext.diff.trim().length === 0 ||
                  currentDiffContext.files.length === 0
                ) {
                  throw new UserInputError("No remaining safe text changes are available to summarize.");
                }

                const [nextPushReadiness, pendingPushCount] = await Promise.all([
                  gitService.getPushReadiness(workspacePath),
                  gitService.getUnpushedCommitCount(workspacePath)
                ]);

                return {
                  diffContext: currentDiffContext,
                  canPush: nextPushReadiness.canPush,
                  pushDisabledReason: nextPushReadiness.canPush
                    ? undefined
                    : nextPushReadiness.reason,
                  pendingPushCount,
                  canReviewChanges: currentDiffContext.files.length > 0,
                  activityHistory,
                  recovered: false
                };
              }
            },
            workspacePath
          );
          createdPanel = panel;
          context.subscriptions.push(panel);
        } catch (error) {
          const retry = await showRetryableError(
            error instanceof CommitCraftError ? error.userMessage : formatError(error)
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
    throw new UserInputError("Generate a commit message before committing.");
  }

  return generatedDiffContext.files;
}

interface GeneratedDataState {
  currentDiffContext: DiffContext;
  generatedDiffContext: DiffContext | undefined;
  generatedMessage: GeneratedCommitMessage | undefined;
  generatedModelUsed: string | undefined;
  generatedRecovered: boolean;
  generatedRecoveryReason: string | undefined;
}

function getCurrentReviewData(
  state: GeneratedDataState
): Omit<CommitReviewData, "canPush" | "pushDisabledReason"> {
  return {
    message: state.generatedMessage,
    modelUsed: state.generatedModelUsed,
    diffContext: state.generatedDiffContext ?? state.currentDiffContext,
    recovered: state.generatedRecovered,
    recoveryReason: state.generatedRecoveryReason
  };
}

async function buildPostCommitData(
  gitService: GitService,
  workspacePath: string,
  status: "committed" | "pushed",
  generatedData: Omit<CommitReviewData, "canPush" | "pushDisabledReason">
): Promise<CommitReviewData> {
  const [pushReadiness, commitHash, pendingPushCount, canReviewChanges] = await Promise.all([
    gitService.getPushReadiness(workspacePath),
    gitService.getHeadShortHash(workspacePath).catch(() => undefined),
    gitService.getUnpushedCommitCount(workspacePath),
    gitService.hasChanges(workspacePath)
  ]);

  return {
    ...generatedData,
    canPush: pushReadiness.canPush,
    pushDisabledReason: pushReadiness.canPush ? undefined : pushReadiness.reason,
    pendingPushCount,
    canReviewChanges,
    commitState: {
      status,
      commitHash
    }
  };
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
    throw new UserInputError("Commit message cannot be empty.");
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

async function pushWithConfirmation(
  gitService: GitService,
  workspacePath: string
): Promise<PushActionResult> {
  const readiness = await gitService.getPushReadiness(workspacePath);
  if (!readiness.canPush) {
    await showPlainError(readiness.reason ?? "This branch cannot be pushed.");
    return { pushed: false };
  }

  if (
    !(await confirmAction(
      `Push ${readiness.branchName} to ${readiness.remoteName ?? "origin"}?`,
      "Push"
    ))
  ) {
    return { pushed: false };
  }

  await gitService.push(workspacePath);
  await showInfo("Branch pushed.");
  return {
    pushed: true,
    branchName: readiness.branchName,
    remoteName: readiness.remoteName ?? "origin"
  };
}

async function undoCommitWithConfirmation(
  gitService: GitService,
  workspacePath: string
): Promise<boolean> {
  if (
    !(await confirmAction("Undo the last local commit and keep its changes staged?", "Undo Commit"))
  ) {
    return false;
  }

  await gitService.undoLastCommit(workspacePath);
  await showInfo("Commit undone. Changes are staged.");
  return true;
}

function createEmptyDiffContext(): DiffContext {
  return {
    diff: "",
    fullDiff: "",
    diffSource: "unstaged",
    files: [],
    excludedFiles: [],
    fileStats: {},
    stats: {
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0
    },
    truncated: false,
    warnings: [],
    maxDiffCharacters: 0
  };
}

interface PushActionResult {
  pushed: boolean;
  branchName?: string;
  remoteName?: string;
}

function createActivityItem(
  type: ActivityHistoryItem["type"],
  title: string,
  detail?: string,
  hash?: string
): ActivityHistoryItem {
  return {
    type,
    title,
    detail: detail?.trim(),
    hash
  };
}

function formatPushActivityDetail(result: PushActionResult): string {
  if (result.branchName && result.remoteName) {
    return `${result.branchName} to ${result.remoteName}`;
  }

  return "Branch pushed.";
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function classifyNetworkError(error: unknown): NetworkError {
  if (error instanceof NetworkError) {
    return error;
  }
  const message = formatError(error);
  if (/timed out/i.test(message)) {
    return new NetworkError("Request timed out. Check your connection and try again.", message);
  }
  if (/401|403|authentication|unauthorized/i.test(message)) {
    return new NetworkError(
      'Invalid API key. Re-enter it with "CommitCraft: Set API Key".',
      message
    );
  }
  if (/429|rate limit/i.test(message)) {
    return new NetworkError("Rate limit hit. Wait a moment and try again.", message);
  }
  if (/5\d{2}|service unavailable|internal server/i.test(message)) {
    return new NetworkError("OpenRouter is temporarily unavailable. Try again shortly.", message);
  }
  return new NetworkError(message, message);
}
