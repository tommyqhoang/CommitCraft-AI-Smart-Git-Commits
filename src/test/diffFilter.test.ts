import { describe, expect, it } from "vitest";

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { collectDiffContext } from "../git/diffCollector";
import { isSafeDiffFile, truncateDiff } from "../git/diffCollector";

const execFileAsync = promisify(execFile);

describe("diff safety helpers", () => {
  it("rejects ignored secret, env, lock, and binary-like files", () => {
    expect(isSafeDiffFile("src/extension.ts")).toBe(true);
    expect(isSafeDiffFile(".env")).toBe(false);
    expect(isSafeDiffFile("secrets/openrouter-token.txt")).toBe(false);
    expect(isSafeDiffFile("assets/icon.png")).toBe(false);
    expect(isSafeDiffFile("package-lock.json")).toBe(false);
  });

  it("truncates diffs with an explicit marker", () => {
    const truncated = truncateDiff("abcdef", 3);

    expect(truncated.truncated).toBe(true);
    expect(truncated.diff).toContain("abc");
    expect(truncated.diff).toContain("[diff truncated");
  });

  it("uses only staged files and stats when staged changes exist", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "staged.txt"), "base\nstaged\n");
      await git(repoPath, ["add", "staged.txt"]);
      await writeFile(path.join(repoPath, "unstaged.txt"), "base\nunstaged\n");
      await writeFile(path.join(repoPath, "untracked.txt"), "new\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: true,
        maxDiffCharacters: 60_000
      });

      expect(context.diffSource).toBe("staged");
      expect(context.files).toEqual(["staged.txt"]);
      expect(context.diff).toContain("staged.txt");
      expect(context.diff).not.toContain("unstaged.txt");
      expect(context.diff).not.toContain("untracked.txt");
      expect(context.stats).toEqual({
        filesChanged: 1,
        linesAdded: 1,
        linesRemoved: 0
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("keeps full stats when a diff is truncated for the prompt", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "tracked.txt"), "base\none\ntwo\nthree\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: false,
        maxDiffCharacters: 80
      });

      expect(context.truncated).toBe(true);
      expect(context.stats).toEqual({
        filesChanged: 1,
        linesAdded: 3,
        linesRemoved: 0
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});

async function createGitRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(tmpdir(), "ai-commit-test-"));

  await git(repoPath, ["init"]);
  await git(repoPath, ["config", "user.email", "commitcraft-test@invalid.local"]);
  await git(repoPath, ["config", "user.name", "Test User"]);
  await writeFile(path.join(repoPath, "staged.txt"), "base\n");
  await writeFile(path.join(repoPath, "unstaged.txt"), "base\n");
  await writeFile(path.join(repoPath, "tracked.txt"), "base\n");
  await git(repoPath, ["add", "."]);
  await git(repoPath, ["commit", "-m", "chore: baseline"]);

  return repoPath;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}
