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
