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

  it("rejects commit requests without an explicit file list", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      await expect(
        service.commit({
          workspacePath: repoPath,
          message: "chore: empty",
          filesToStage: [],
          stageFilesBeforeCommit: true
        })
      ).rejects.toThrow("No files specified to commit.");
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

  it("push throws when the repository is in detached HEAD state", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      const hash = await git(repoPath, ["rev-parse", "HEAD"]);
      await git(repoPath, ["checkout", "--detach", hash.trim()]);
      await expect(service.push(repoPath)).rejects.toThrow("detached HEAD");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("push throws when no remote is configured", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      await expect(service.push(repoPath)).rejects.toThrow("No Git remote");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("push throws when the remote rejects a non-fast-forward update", async () => {
    const { repoPath, remotePath } = await createGitRepoWithRemote();
    const clonePath = await mkdtemp(path.join(tmpdir(), "commitcraft-clone-"));
    const service = new GitService();

    try {
      // Push a diverging commit from a sibling clone so the remote advances
      await git(clonePath, ["clone", remotePath, "."]);
      await git(clonePath, ["config", "user.email", "commitcraft-test@invalid.local"]);
      await git(clonePath, ["config", "user.name", "Test User"]);
      await writeFile(path.join(clonePath, "remote.txt"), "remote\n");
      await git(clonePath, ["add", "remote.txt"]);
      await git(clonePath, ["commit", "-m", "chore: diverge remote"]);
      await git(clonePath, ["push"]);

      // Add a conflicting commit on the original repo (history has diverged)
      await writeFile(path.join(repoPath, "local.txt"), "local\n");
      await service.commit({
        workspacePath: repoPath,
        message: "chore: diverge local",
        filesToStage: ["local.txt"],
        stageFilesBeforeCommit: true
      });

      await expect(service.push(repoPath)).rejects.toThrow();
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(remotePath, { recursive: true, force: true });
      await rm(clonePath, { recursive: true, force: true });
    }
  });

  it("getPushReadiness falls back to first available remote when branch config points to a stale remote", async () => {
    const repoPath = await createGitRepo();
    const remotePath = await mkdtemp(path.join(tmpdir(), "commitcraft-remote-"));
    const service = new GitService();

    try {
      await git(remotePath, ["init", "--bare"]);
      await git(repoPath, ["remote", "add", "upstream", remotePath]);
      // Manually set branch remote config to a name that doesn't exist in the remote list
      await git(repoPath, ["config", "branch.main.remote", "non-existent-remote"]);

      const readiness = await service.getPushReadiness(repoPath);
      // Should fall back to "upstream" (first in remoteList) rather than the stale "non-existent-remote"
      expect(readiness.canPush).toBe(true);
      expect(readiness.remoteName).toBe("upstream");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(remotePath, { recursive: true, force: true });
    }
  });

  it("getPushReadiness returns canPush:false when branch config remote is stale and no other remotes exist", async () => {
    const repoPath = await createGitRepo();
    const service = new GitService();

    try {
      // No actual remote added — only a stale branch config entry
      await git(repoPath, ["config", "branch.main.remote", "non-existent-remote"]);

      const readiness = await service.getPushReadiness(repoPath);
      expect(readiness.canPush).toBe(false);
      expect(readiness.reason).toContain("No Git remote");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("getPushReadiness returns canPush:true with remoteName when remote exists but branch has no tracking", async () => {
    const repoPath = await createGitRepo();
    const remotePath = await mkdtemp(path.join(tmpdir(), "commitcraft-remote-"));
    const service = new GitService();

    try {
      await git(remotePath, ["init", "--bare"]);
      await git(repoPath, ["remote", "add", "origin", remotePath]);
      // Intentionally skip push -u so there is no tracking branch

      const readiness = await service.getPushReadiness(repoPath);
      expect(readiness.canPush).toBe(true);
      expect(readiness.remoteName).toBe("origin");
      expect(readiness.branchName).toBeTruthy();
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(remotePath, { recursive: true, force: true });
    }
  });

  it("getUnpushedCommitCount counts all local commits ahead of the remote after the first push", async () => {
    const { repoPath, remotePath } = await createGitRepoWithRemote();
    const service = new GitService();

    try {
      for (const name of ["a.txt", "b.txt", "c.txt"]) {
        await writeFile(path.join(repoPath, name), `${name}\n`);
        await service.commit({
          workspacePath: repoPath,
          message: `feat: add ${name}`,
          filesToStage: [name],
          stageFilesBeforeCommit: true
        });
      }

      await expect(service.getUnpushedCommitCount(repoPath)).resolves.toBe(3);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
      await rm(remotePath, { recursive: true, force: true });
    }
  });

  it("counts against origin HEAD when no upstream branch is configured", async () => {
    const { repoPath, remotePath } = await createGitRepoWithRemote();
    const service = new GitService();

    try {
      await git(repoPath, ["remote", "set-head", "origin", "-a"]);
      await git(repoPath, ["branch", "--unset-upstream"]);
      await writeFile(path.join(repoPath, "local-only.txt"), "local\n");
      await service.commit({
        workspacePath: repoPath,
        message: "feat: add local only file",
        filesToStage: ["local-only.txt"],
        stageFilesBeforeCommit: true
      });

      await expect(service.getUnpushedCommitCount(repoPath)).resolves.toBe(1);
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
