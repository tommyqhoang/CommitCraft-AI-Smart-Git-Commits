import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitCommitOptions {
  workspacePath: string;
  message: string;
  filesToStage: string[];
  stageFilesBeforeCommit: boolean;
}

export interface PushReadiness {
  canPush: boolean;
  reason?: string;
  branchName: string;
  remoteName?: string;
}

export class GitService {
  async hasChanges(workspacePath: string): Promise<boolean> {
    const output = await this.git(workspacePath, ["status", "--porcelain=v1", "-uall"]);
    return output.trim().length > 0;
  }

  async hasStagedChanges(workspacePath: string): Promise<boolean> {
    const output = await this.git(workspacePath, ["diff", "--cached", "--name-only"]);
    return output.trim().length > 0;
  }

  async commit(options: GitCommitOptions): Promise<void> {
    if (options.filesToStage.length === 0) {
      throw new Error("No files specified to commit.");
    }

    if (options.stageFilesBeforeCommit) {
      await this.git(options.workspacePath, ["add", "--", ...options.filesToStage]);
    }

    await this.git(options.workspacePath, [
      "commit",
      "-m",
      options.message,
      "--",
      ...options.filesToStage
    ]);
  }

  async getPushReadiness(workspacePath: string): Promise<PushReadiness> {
    const branchName = (await this.git(workspacePath, ["branch", "--show-current"])).trim();
    if (branchName.length === 0) {
      return {
        canPush: false,
        reason: "Cannot push from a detached HEAD state.",
        branchName: "detached HEAD"
      };
    }

    const remoteName = await this.git(workspacePath, ["config", `branch.${branchName}.remote`])
      .then((value) => value.trim())
      .catch(() => "");
    const remotes = await this.git(workspacePath, ["remote"]);
    const remoteList = remotes
      .split(/\r?\n/)
      .map((remote) => remote.trim())
      .filter(Boolean);

    if (remoteName.length === 0 && remoteList.length === 0) {
      return {
        canPush: false,
        reason: "No Git remote is configured for this repository.",
        branchName
      };
    }

    return {
      canPush: true,
      branchName,
      remoteName: remoteName || remoteList[0]
    };
  }

  async push(workspacePath: string): Promise<void> {
    const readiness = await this.getPushReadiness(workspacePath);
    if (!readiness.canPush) {
      throw new Error(readiness.reason ?? "Repository is not ready to push.");
    }

    await this.git(workspacePath, [
      "push",
      "-u",
      readiness.remoteName ?? "origin",
      readiness.branchName
    ]);
  }

  async getHeadShortHash(workspacePath: string): Promise<string> {
    return (await this.git(workspacePath, ["rev-parse", "--short", "HEAD"])).trim();
  }

  async getUnpushedCommitCount(workspacePath: string): Promise<number> {
    const upstream = await this.git(workspacePath, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}"
    ])
      .then((value) => value.trim())
      .catch(() => "");

    if (upstream.length > 0) {
      return this.countRevisions(workspacePath, `${upstream}..HEAD`);
    }

    // No tracking branch — count against origin/HEAD so new branches don't
    // incorrectly report the entire repo history as unpushed.
    try {
      await this.git(workspacePath, ["rev-parse", "--verify", "refs/remotes/origin/HEAD"]);
      return await this.countRevisions(workspacePath, "refs/remotes/origin/HEAD..HEAD");
    } catch {
      return 0;
    }
  }

  async undoLastCommit(workspacePath: string): Promise<void> {
    await this.git(workspacePath, ["reset", "--soft", "HEAD~1"]);
  }

  private async countRevisions(workspacePath: string, revisionRange: string): Promise<number> {
    const output = await this.git(workspacePath, ["rev-list", "--count", revisionRange]);
    return Number.parseInt(output.trim(), 10) || 0;
  }

  private async git(workspacePath: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("git", args, {
      cwd: workspacePath,
      maxBuffer: 20 * 1024 * 1024
    });
    return stdout;
  }
}
