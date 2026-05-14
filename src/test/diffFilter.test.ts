import { describe, expect, it } from "vitest";

import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  collectDiffContext,
  detectLanguageHints,
  filterDiffContextToFiles,
  getBranchName,
  getExcludedFileReason,
  getRepositoryName,
  parseNumstat
} from "../git/diffCollector";
import { isSafeDiffFile, truncateDiff } from "../git/diffCollector";

const execFileAsync = promisify(execFile);

describe("diff safety helpers", () => {
  it("rejects ignored secret, env, lock, and binary-like files", () => {
    expect(isSafeDiffFile("src/extension.ts")).toBe(true);
    expect(isSafeDiffFile(".env")).toBe(false);
    expect(isSafeDiffFile("config\\.env.local")).toBe(false);
    expect(isSafeDiffFile("secrets/openrouter-token.txt")).toBe(false);
    expect(isSafeDiffFile("private/token.value")).toBe(false);
    expect(isSafeDiffFile("certs/client.pem")).toBe(false);
    expect(isSafeDiffFile("assets/icon.png")).toBe(false);
    expect(isSafeDiffFile("package-lock.json")).toBe(false);
    expect(getExcludedFileReason("src/extension.ts")).toBeUndefined();
  });

  it("parses git numstat output into per-file added/removed counts", () => {
    const output = "3\t1\tsrc/foo.ts\n0\t5\tsrc/bar.ts\n2\t0\tsrc/new.ts\n";
    const stats = parseNumstat(output);

    expect(stats["src/foo.ts"]).toEqual({ added: 3, removed: 1 });
    expect(stats["src/bar.ts"]).toEqual({ added: 0, removed: 5 });
    expect(stats["src/new.ts"]).toEqual({ added: 2, removed: 0 });
  });

  it("treats binary file entries in numstat as zero added/removed", () => {
    const output = "-\t-\tassets/icon.png\n1\t0\tsrc/foo.ts\n";
    const stats = parseNumstat(output);

    expect(stats["assets/icon.png"]).toEqual({ added: 0, removed: 0 });
    expect(stats["src/foo.ts"]).toEqual({ added: 1, removed: 0 });
  });

  it("truncates diffs with an explicit marker", () => {
    const truncated = truncateDiff("abcdef", 3);

    expect(truncated.truncated).toBe(true);
    expect(truncated.diff).toContain("abc");
    expect(truncated.diff).toContain("[diff truncated");
  });

  it("returns unchanged diffs that fit within the limit", () => {
    const result = truncateDiff("abc", 3);

    expect(result).toEqual({ diff: "abc", truncated: false });
  });

  it("detects up to six language hints from changed file extensions", async () => {
    await expect(
      detectLanguageHints(["a.ts", "b.tsx", "c.js", "d.py", "e.go", "f.rs", "g.java", "README"])
    ).resolves.toEqual(["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java"]);
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

  it("reports excluded files with developer-readable reasons", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, ".env"), "OPENROUTER_API_KEY=secret\n");
      await writeFile(path.join(repoPath, "package-lock.json"), "{}\n");
      await writeFile(path.join(repoPath, "assets.png"), "not really binary\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: true,
        maxDiffCharacters: 60_000
      });

      expect(context.excludedFiles).toEqual([
        { path: ".env", reason: "secret-like file" },
        { path: "assets.png", reason: "binary or generated asset" },
        { path: "package-lock.json", reason: "lockfile" }
      ]);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("collects safe untracked text files when requested", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "new-file.txt"), "new\ncontent\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: true,
        maxDiffCharacters: 60_000
      });

      expect(context.diffSource).toBe("unstaged");
      expect(context.files).toContain("new-file.txt");
      expect(context.diff).toContain("new-file.txt");
      expect(context.diff).toContain("+content");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("excludes untracked symlinks instead of following them into prompt context", async () => {
    const repoPath = await createGitRepo();
    const externalPath = path.join(
      await mkdtemp(path.join(tmpdir(), "ai-commit-secret-")),
      "secret.txt"
    );

    try {
      await writeFile(externalPath, "OPENROUTER_API_KEY=outside-workspace\n");
      await symlink(externalPath, path.join(repoPath, "linked-secret.txt"));

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: true,
        maxDiffCharacters: 60_000
      });

      expect(context.files).not.toContain("linked-secret.txt");
      expect(context.diff).not.toContain("OPENROUTER_API_KEY");
      expect(context.excludedFiles).toContainEqual({
        path: "linked-secret.txt",
        reason: "unsupported file type"
      });
    } finally {
      await rm(path.dirname(externalPath), { recursive: true, force: true });
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("omits untracked files when includeUntrackedFiles is false", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "new-file.txt"), "new\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: false,
        maxDiffCharacters: 60_000
      });

      expect(context.files).not.toContain("new-file.txt");
      expect(context.diff).not.toContain("new-file.txt");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("can narrow a collected diff context to selected files", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "staged.txt"), "base\nstaged\n");
      await writeFile(path.join(repoPath, "tracked.txt"), "base\ntracked\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: false,
        maxDiffCharacters: 60_000
      });
      const selected = filterDiffContextToFiles(context, ["tracked.txt"]);

      expect(selected.files).toEqual(["tracked.txt"]);
      expect(selected.diff).toContain("tracked.txt");
      expect(selected.diff).not.toContain("staged.txt");
      expect(selected.stats).toEqual({
        filesChanged: 1,
        linesAdded: 1,
        linesRemoved: 0
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("returns fallback repository metadata outside a git repo", async () => {
    const tempPath = await mkdtemp(path.join(tmpdir(), "ai-commit-no-git-"));

    try {
      await expect(getRepositoryName(tempPath)).resolves.toBe(path.basename(tempPath));
      await expect(getBranchName(tempPath)).resolves.toBe("unknown");
    } finally {
      await rm(tempPath, { recursive: true, force: true });
    }
  });

  it("reports detached HEAD when the branch name is empty", async () => {
    const repoPath = await createGitRepo();

    try {
      const hash = (await git(repoPath, ["rev-parse", "HEAD"])).trim();
      await git(repoPath, ["checkout", "--detach", hash]);

      await expect(getBranchName(repoPath)).resolves.toBe("detached HEAD");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("filters selected files from the full diff even when the preview diff was truncated", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "staged.txt"), `base\n${"x".repeat(500)}\n`);
      await writeFile(path.join(repoPath, "tracked.txt"), "base\nselected\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: false,
        maxDiffCharacters: 120
      });
      const selected = filterDiffContextToFiles(context, ["tracked.txt"]);

      expect(context.truncated).toBe(true);
      expect(context.diff).not.toContain("tracked.txt");
      expect(selected.diff).toContain("tracked.txt");
      expect(selected.stats).toEqual({
        filesChanged: 1,
        linesAdded: 1,
        linesRemoved: 0
      });
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("drops stale truncation warnings when the filtered diff fits within the limit", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "staged.txt"), `base\n${"x".repeat(1000)}\n`);
      await writeFile(path.join(repoPath, "tracked.txt"), "base\nsmall\n");

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: false,
        maxDiffCharacters: 400
      });

      expect(context.truncated).toBe(true);
      expect(context.warnings.some((w) => w.startsWith("Diff was truncated"))).toBe(true);

      const selected = filterDiffContextToFiles(context, ["tracked.txt"]);

      expect(selected.truncated).toBe(false);
      expect(selected.warnings.some((w) => w.startsWith("Diff was truncated"))).toBe(false);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("excludes oversized untracked text files with a visible reason", async () => {
    const repoPath = await createGitRepo();

    try {
      await writeFile(path.join(repoPath, "large.txt"), `${"x".repeat(100_001)}\n`);

      const context = await collectDiffContext(repoPath, {
        includeUntrackedFiles: true,
        maxDiffCharacters: 60_000
      });

      expect(context.files).not.toContain("large.txt");
      expect(context.excludedFiles).toContainEqual({
        path: "large.txt",
        reason: "file too large"
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
