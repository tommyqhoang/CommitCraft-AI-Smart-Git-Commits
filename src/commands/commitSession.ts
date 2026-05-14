import * as vscode from "vscode";

import { openRouterTokenSecretKey } from "../config/settings";
import type { AiCommitSettings } from "../config/settings";
import {
  collectDiffContext,
  detectLanguageHints,
  filterDiffContextToFiles,
  getBranchName,
  getRepositoryName,
  type DiffContext
} from "../git/diffCollector";
import { GitService } from "../git/gitService";
import { buildCommitPrompt } from "../openrouter/commitPrompt";
import { OpenRouterClient, type GenerateCommitResponse } from "../openrouter/openRouterClient";
import { parseCommitResponse, type GeneratedCommitMessage } from "../openrouter/responseParser";
import { setOpenRouterToken } from "./setOpenRouterToken";
import { CommitCraftError, NetworkError, UserInputError } from "../errors";
import { confirmAction, showInfo, showPlainError } from "../ui/notifications";
import type { CommitReviewData } from "../ui/commitReviewPanel";
import type { ActivityHistoryItem } from "../ui/commitAssistantHtml";

export interface CommitSessionDeps {
  gitService: GitService;
  openRouterClient: OpenRouterClient;
  context: vscode.ExtensionContext;
  settings: AiCommitSettings;
  workspacePath: string;
}

interface PushActionResult {
  pushed: boolean;
  branchName?: string;
  remoteName?: string;
}

export class CommitSession {
  private currentDiffContext: DiffContext;
  private generatedDiffContext: DiffContext | undefined = undefined;
  private generatedMessage: GeneratedCommitMessage | undefined = undefined;
  private generatedModelUsed: string | undefined = undefined;
  private generatedRecovered = false;
  private generatedRecoveryReason: string | undefined = undefined;
  readonly activityHistory: ActivityHistoryItem[] = [];

  constructor(
    private readonly deps: CommitSessionDeps,
    initialDiffContext: DiffContext
  ) {
    this.currentDiffContext = initialDiffContext;
  }

  async generate(files: string[]): Promise<CommitReviewData> {
    const selectedDiffContext = filterDiffContextToFiles(this.currentDiffContext, files);
    if (selectedDiffContext.diff.trim().length === 0 || selectedDiffContext.files.length === 0) {
      throw new UserInputError("Select at least one safe changed file to summarize.");
    }
    return this.generateFromDiffContext(selectedDiffContext);
  }

  async regenerate(): Promise<CommitReviewData> {
    if (!this.generatedDiffContext) {
      throw new UserInputError("Generate a commit message before regenerating.");
    }
    return this.generateFromDiffContext(this.generatedDiffContext);
  }

  async commit(message: string): Promise<CommitReviewData | undefined> {
    const hasStagedChanges = await this.deps.gitService.hasStagedChanges(this.deps.workspacePath);
    const committed = await this.commitReviewedMessage(
      message,
      this.getGeneratedFiles(),
      hasStagedChanges
    );
    if (!committed) {
      return undefined;
    }
    const data = await this.buildPostCommitData("committed", this.getCurrentReviewData());
    this.activityHistory.push(
      createActivityItem("commit", "Committed", message, data.commitState?.commitHash)
    );
    return { ...data, activityHistory: this.activityHistory };
  }

  async push(): Promise<CommitReviewData | undefined> {
    const pushed = await this.pushWithConfirmation();
    if (!pushed.pushed) {
      return undefined;
    }
    const data = await this.buildPostCommitData("pushed", this.getCurrentReviewData());
    this.activityHistory.push(
      createActivityItem(
        "push",
        "Pushed",
        formatPushActivityDetail(pushed),
        data.commitState?.commitHash
      )
    );
    return { ...data, activityHistory: this.activityHistory };
  }

  async commitAndPush(message: string): Promise<CommitReviewData | undefined> {
    const hasStagedChanges = await this.deps.gitService.hasStagedChanges(this.deps.workspacePath);
    const committed = await this.commitReviewedMessage(
      message,
      this.getGeneratedFiles(),
      hasStagedChanges
    );
    if (!committed) {
      return undefined;
    }

    const generatedData = this.getCurrentReviewData();
    let pushed: PushActionResult = { pushed: false };
    try {
      pushed = await this.pushWithConfirmation();
    } catch (pushErr) {
      const pushMessage =
        pushErr instanceof CommitCraftError
          ? pushErr.userMessage
          : pushErr instanceof Error
            ? pushErr.message
            : String(pushErr);
      void showPlainError(pushMessage);
    }

    const data = await this.buildPostCommitData(
      pushed.pushed ? "pushed" : "committed",
      generatedData
    );
    this.activityHistory.push(
      createActivityItem("commit", "Committed", message, data.commitState?.commitHash)
    );
    if (pushed.pushed) {
      this.activityHistory.push(
        createActivityItem(
          "push",
          "Pushed",
          formatPushActivityDetail(pushed),
          data.commitState?.commitHash
        )
      );
    }
    return { ...data, activityHistory: this.activityHistory };
  }

  async undoCommit(): Promise<CommitReviewData | undefined> {
    const undone = await this.undoCommitWithConfirmation();
    if (!undone) {
      return undefined;
    }

    this.activityHistory.push(createActivityItem("undo", "Undid Commit", "Changes kept staged."));
    this.currentDiffContext = await collectDiffContext(this.deps.workspacePath, {
      includeUntrackedFiles: this.deps.settings.includeUntrackedFiles,
      maxDiffCharacters: this.deps.settings.maxDiffCharacters
    });
    this.generatedDiffContext = undefined;
    this.generatedMessage = undefined;
    this.generatedModelUsed = undefined;
    this.generatedRecovered = false;
    this.generatedRecoveryReason = undefined;

    const [nextPushReadiness, pendingPushCount] = await Promise.all([
      this.deps.gitService.getPushReadiness(this.deps.workspacePath),
      this.deps.gitService.getUnpushedCommitCount(this.deps.workspacePath)
    ]);

    return {
      diffContext: this.currentDiffContext,
      canPush: nextPushReadiness.canPush,
      pushDisabledReason: nextPushReadiness.canPush ? undefined : nextPushReadiness.reason,
      pendingPushCount,
      canReviewChanges: this.currentDiffContext.files.length > 0,
      activityHistory: this.activityHistory,
      recovered: false
    };
  }

  async reviewChanges(): Promise<CommitReviewData | undefined> {
    this.currentDiffContext = await collectDiffContext(this.deps.workspacePath, {
      includeUntrackedFiles: this.deps.settings.includeUntrackedFiles,
      maxDiffCharacters: this.deps.settings.maxDiffCharacters
    });
    this.generatedDiffContext = undefined;
    this.generatedMessage = undefined;
    this.generatedModelUsed = undefined;
    this.generatedRecovered = false;
    this.generatedRecoveryReason = undefined;

    if (
      this.currentDiffContext.diff.trim().length === 0 ||
      this.currentDiffContext.files.length === 0
    ) {
      throw new UserInputError("No remaining safe text changes are available to summarize.");
    }

    const [nextPushReadiness, pendingPushCount] = await Promise.all([
      this.deps.gitService.getPushReadiness(this.deps.workspacePath),
      this.deps.gitService.getUnpushedCommitCount(this.deps.workspacePath)
    ]);

    return {
      diffContext: this.currentDiffContext,
      canPush: nextPushReadiness.canPush,
      pushDisabledReason: nextPushReadiness.canPush ? undefined : nextPushReadiness.reason,
      pendingPushCount,
      canReviewChanges: this.currentDiffContext.files.length > 0,
      activityHistory: this.activityHistory,
      recovered: false
    };
  }

  private async generateFromDiffContext(diffCtx: DiffContext): Promise<CommitReviewData> {
    const token = await this.getOrPromptForToken();
    if (!token) {
      throw new UserInputError("Add an OpenRouter API key to generate a commit message.");
    }

    const [repositoryName, branchName, languageHints] = await Promise.all([
      getRepositoryName(this.deps.workspacePath),
      getBranchName(this.deps.workspacePath),
      detectLanguageHints(diffCtx.files)
    ]);

    const prompt = buildCommitPrompt({
      repositoryName,
      branchName,
      diff: diffCtx.diff,
      diffSource: diffCtx.diffSource,
      files: diffCtx.files,
      languageHints,
      stats: diffCtx.stats,
      truncated: diffCtx.truncated
    });

    let aiResponse: GenerateCommitResponse;
    try {
      aiResponse = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "CommitCraft: generating smart Git commit",
          cancellable: false
        },
        () =>
          this.deps.openRouterClient.generateCommitMessage({
            token,
            model: this.deps.settings.openRouterModel,
            fallbackModel: this.deps.settings.fallbackModel,
            prompt
          })
      );
    } catch (err) {
      throw classifyNetworkError(err);
    }

    const parsed = parseCommitResponse(aiResponse.content);
    this.generatedDiffContext = diffCtx;
    this.generatedMessage = parsed.message;
    this.generatedModelUsed = aiResponse.modelUsed;
    this.generatedRecovered = parsed.recovered;
    this.generatedRecoveryReason = parsed.recoveryReason;

    const [freshPushReadiness, freshPendingPushCount] = await Promise.all([
      this.deps.gitService.getPushReadiness(this.deps.workspacePath),
      this.deps.gitService.getUnpushedCommitCount(this.deps.workspacePath)
    ]);

    return {
      message: parsed.message,
      modelUsed: aiResponse.modelUsed,
      diffContext: diffCtx,
      recovered: parsed.recovered,
      recoveryReason: parsed.recoveryReason,
      canPush: freshPushReadiness.canPush,
      pushDisabledReason: freshPushReadiness.canPush ? undefined : freshPushReadiness.reason,
      pendingPushCount: freshPendingPushCount,
      activityHistory: this.activityHistory
    };
  }

  private async buildPostCommitData(
    status: "committed" | "pushed",
    generatedData: Omit<CommitReviewData, "canPush" | "pushDisabledReason">
  ): Promise<CommitReviewData> {
    const [pushReadiness, commitHash, pendingPushCount, canReviewChanges] = await Promise.all([
      this.deps.gitService.getPushReadiness(this.deps.workspacePath),
      this.deps.gitService.getHeadShortHash(this.deps.workspacePath).catch(() => undefined),
      this.deps.gitService.getUnpushedCommitCount(this.deps.workspacePath),
      this.deps.gitService.hasChanges(this.deps.workspacePath)
    ]);

    return {
      ...generatedData,
      canPush: pushReadiness.canPush,
      pushDisabledReason: pushReadiness.canPush ? undefined : pushReadiness.reason,
      pendingPushCount,
      canReviewChanges,
      commitState: { status, commitHash }
    };
  }

  private async commitReviewedMessage(
    message: string,
    files: string[],
    hasStagedChanges: boolean
  ): Promise<boolean> {
    const normalized = message.trim();
    if (normalized.length === 0) {
      throw new UserInputError("Commit message cannot be empty.");
    }

    if (!this.deps.settings.skipCommitConfirmation) {
      const action = hasStagedChanges ? "Commit Staged Changes" : "Stage and Commit";
      const prompt = hasStagedChanges
        ? "Commit the currently staged changes with this message?"
        : "Stage the reviewed safe files and commit them with this message?";
      if (!(await confirmAction(prompt, action))) {
        return false;
      }
    }

    await this.deps.gitService.commit({
      workspacePath: this.deps.workspacePath,
      message: normalized,
      filesToStage: files,
      stageFilesBeforeCommit: !hasStagedChanges
    });
    await showInfo("Commit created.");
    return true;
  }

  private async pushWithConfirmation(): Promise<PushActionResult> {
    const readiness = await this.deps.gitService.getPushReadiness(this.deps.workspacePath);
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

    await this.deps.gitService.push(this.deps.workspacePath);
    await showInfo("Branch pushed.");
    return {
      pushed: true,
      branchName: readiness.branchName,
      remoteName: readiness.remoteName ?? "origin"
    };
  }

  private async undoCommitWithConfirmation(): Promise<boolean> {
    if (
      !(await confirmAction(
        "Undo the last local commit and keep its changes staged?",
        "Undo Commit"
      ))
    ) {
      return false;
    }
    await this.deps.gitService.undoLastCommit(this.deps.workspacePath);
    await showInfo("Commit undone. Changes are staged.");
    return true;
  }

  private getGeneratedFiles(): string[] {
    if (!this.generatedDiffContext) {
      throw new UserInputError("Generate a commit message before committing.");
    }
    return this.generatedDiffContext.files;
  }

  private getCurrentReviewData(): Omit<CommitReviewData, "canPush" | "pushDisabledReason"> {
    return {
      message: this.generatedMessage,
      modelUsed: this.generatedModelUsed,
      diffContext: this.generatedDiffContext ?? this.currentDiffContext,
      recovered: this.generatedRecovered,
      recoveryReason: this.generatedRecoveryReason
    };
  }

  private async getOrPromptForToken(): Promise<string | undefined> {
    let token = await this.deps.context.secrets.get(openRouterTokenSecretKey);
    if (!token) {
      const selected = await vscode.window.showWarningMessage(
        "CommitCraft needs your OpenRouter API key once before it can generate commit messages.",
        "Add API Key"
      );
      if (selected === "Add API Key") {
        const saved = await setOpenRouterToken(this.deps.context);
        if (saved) {
          token = await this.deps.context.secrets.get(openRouterTokenSecretKey);
        }
      }
    }
    return token;
  }
}

function createActivityItem(
  type: ActivityHistoryItem["type"],
  title: string,
  detail?: string,
  hash?: string
): ActivityHistoryItem {
  return { type, title, detail: detail?.trim(), hash };
}

function formatPushActivityDetail(result: PushActionResult): string {
  if (result.branchName && result.remoteName) {
    return `${result.branchName} to ${result.remoteName}`;
  }
  return "Branch pushed.";
}

export function classifyNetworkError(error: unknown): NetworkError {
  if (error instanceof NetworkError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
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
