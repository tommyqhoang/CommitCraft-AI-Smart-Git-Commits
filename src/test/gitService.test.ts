import { describe, expect, it } from "vitest";

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { GitService } from "../git/gitService";

const execFileAsync = promisify(execFile);

describe("GitService", () => {
  it("counts commits that are ahead of the upstream branch", async () => {
    const { repoPath, remotePath } = await createGitRepoWithRemote();
    const service = new GitService();

    try {
      await writeFile(path.join(repoPath, "file.txt"), "base\nunpushed\n");
      await service.commit({
        workspacePath: repoPath,
        message: "feat: create unpushed commit",
        filesToStage: ["file.txt"],
        stageFilesBeforeCommit: true
      });

      await expect(service.getUnpushedCommitCount(repoPath)).resolves.toBe(1);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(remotePath, { recursive: true, force: true });
    }
  });

  it("returns 0 unpushed commits when no upstream and no origin/HEAD exists", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      await expect(service.getUnpushedCommitCount(repoPath)).resolves.toBe(0);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("undoes the last local commit while keeping changes staged", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      await writeFile(path.join(repoPath, "file.txt"), "base\nchanged\n");
      await service.commit({
        workspacePath: repoPath,
        message: "feat: update file",
        filesToStage: ["file.txt"],
        stageFilesBeforeCommit: true
      });

      await service.undoLastCommit(repoPath);

      const log = await git(repoPath, ["log", "--oneline"]);
      const staged = await git(repoPath, ["diff", "--cached", "--name-only"]);

      expect(log).not.toContain("feat: update file");
      expect(staged.trim()).toBe("file.txt");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("detects working tree changes and reports clean state after commit", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      expect(await service.hasChanges(repoPath)).toBe(false);
      await writeFile(path.join(repoPath, "file.txt"), "modified\n");
      expect(await service.hasChanges(repoPath)).toBe(true);
      await service.commit({
        workspacePath: repoPath,
        message: "chore: apply modification",
        filesToStage: ["file.txt"],
        stageFilesBeforeCommit: true
      });
      expect(await service.hasChanges(repoPath)).toBe(false);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("detects staged changes independently of unstaged changes", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      expect(await service.hasStagedChanges(repoPath)).toBe(false);
      await writeFile(path.join(repoPath, "file.txt"), "unstaged change\n");
      expect(await service.hasStagedChanges(repoPath)).toBe(false);
      await git(repoPath, ["add", "file.txt"]);
      expect(await service.hasStagedChanges(repoPath)).toBe(true);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("returns a 7-character short hash for HEAD", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      const hash = await service.getHeadShortHash(repoPath);
      expect(hash).toMatch(/^[0-9a-f]{7,}$/);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("reports canPush:false for a detached HEAD", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      const hash = await git(repoPath, ["rev-parse", "HEAD"]);
      await git(repoPath, ["checkout", "--detach", hash.trim()]);

      const readiness = await service.getPushReadiness(repoPath);
      expect(readiness.canPush).toBe(false);
      expect(readiness.reason).toContain("detached HEAD");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("reports canPush:false when no remote is configured", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      const readiness = await service.getPushReadiness(repoPath);
      expect(readiness.canPush).toBe(false);
      expect(readiness.reason).toContain("No Git remote");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("reports canPush:true with branch and remote name when a remote exists", async () => {
    const { repoPath, remotePath } = await createGitRepoWithRemote();
    const service = new GitService();

    try {
      const readiness = await service.getPushReadiness(repoPath);
      expect(readiness.canPush).toBe(true);
      expect(readiness.branchName).toBeTruthy();
      expect(readiness.remoteName).toBe("origin");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(remotePath, { recursive: true, force: true });
    }
  });

  it("pushes a local commit to the remote and updates the unpushed count", async () => {
    const { repoPath, remotePath } = await createGitRepoWithRemote();
    const service = new GitService();

    try {
      await writeFile(path.join(repoPath, "file.txt"), "pushed content\n");
      await service.commit({
        workspacePath: repoPath,
        message: "feat: add pushed content",
        filesToStage: ["file.txt"],
        stageFilesBeforeCommit: true
      });

      await expect(service.getUnpushedCommitCount(repoPath)).resolves.toBe(1);
      await service.push(repoPath);
      await expect(service.getUnpushedCommitCount(repoPath)).resolves.toBe(0);

      const remoteLog = await git(remotePath, ["log", "--oneline"]);
      expect(remoteLog).toContain("feat: add pushed content");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(remotePath, { recursive: true, force: true });
    }
  });
});

async function createGitRepoWithRemote(): Promise<{ repoPath: string; remotePath: string }> {
  const repoPath = await createGitRepo();
  const remotePath = await mkdtemp(path.join(tmpdir(), "commitcraft-remote-"));

  await git(remotePath, ["init", "--bare"]);
  await git(repoPath, ["remote", "add", "origin", remotePath]);
  await git(repoPath, ["push", "-u", "origin", "HEAD"]);

  return { repoPath, remotePath };
}

async function createGitRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(tmpdir(), "commitcraft-gitservice-"));

  await git(repoPath, ["init"]);
  await git(repoPath, ["config", "user.email", "commitcraft-test@invalid.local"]);
  await git(repoPath, ["config", "user.name", "Test User"]);
  await writeFile(path.join(repoPath, "file.txt"), "base\n");
  await git(repoPath, ["add", "."]);
  await git(repoPath, ["commit", "-m", "chore: baseline"]);

  return repoPath;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}
