import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { calculateChangeStats, type ChangeStats } from "./changeStats";

const execFileAsync = promisify(execFile);

const unsafeFilePatterns = [
  /^\.env(?:\.|$)/i,
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:secret|secrets|credential|credentials|token|tokens)(?:\/|\.|$)/i,
  /\.(?:png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tar|tgz|7z|mp4|mov|mp3|wav|woff2?|ttf|otf)$/i,
  /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i
];

export type DiffSource = "staged" | "unstaged";

export interface TruncatedDiff {
  diff: string;
  truncated: boolean;
}

export interface DiffContext {
  diff: string;
  diffSource: DiffSource;
  files: string[];
  stats: ChangeStats;
  truncated: boolean;
  warnings: string[];
}

export interface DiffCollectorOptions {
  includeUntrackedFiles: boolean;
  maxDiffCharacters: number;
}

export function isSafeDiffFile(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return !unsafeFilePatterns.some((pattern) => pattern.test(normalized));
}

export function truncateDiff(diff: string, maxCharacters: number): TruncatedDiff {
  if (diff.length <= maxCharacters) {
    return { diff, truncated: false };
  }

  return {
    diff: `${diff.slice(0, maxCharacters)}\n\n[diff truncated after ${maxCharacters} characters]`,
    truncated: true
  };
}

export async function collectDiffContext(
  workspacePath: string,
  options: DiffCollectorOptions
): Promise<DiffContext> {
  await ensureGitRepository(workspacePath);

  const stagedDiff = await git(workspacePath, ["diff", "--cached", "--no-ext-diff", "--"]);
  const hasStaged = stagedDiff.trim().length > 0;
  const diffSource: DiffSource = hasStaged ? "staged" : "unstaged";
  const rawDiff = hasStaged
    ? stagedDiff
    : await git(workspacePath, ["diff", "--no-ext-diff", "--"]);
  const statusFiles = await listChangedFiles(workspacePath);
  const safeFiles = statusFiles.filter(isSafeDiffFile);
  const warnings: string[] = [];

  if (safeFiles.length < statusFiles.length) {
    warnings.push(
      "Some ignored, binary, lock, or secret-like files were excluded from the prompt."
    );
  }

  const untrackedDiff =
    !hasStaged && options.includeUntrackedFiles
      ? await collectUntrackedFileDiff(workspacePath, safeFiles)
      : "";
  const filteredDiff = filterDiffBySafeFiles(`${rawDiff}${untrackedDiff}`, safeFiles);
  const truncated = truncateDiff(filteredDiff, options.maxDiffCharacters);

  if (truncated.truncated) {
    warnings.push(`Diff was truncated to ${options.maxDiffCharacters} characters.`);
  }

  return {
    diff: truncated.diff,
    diffSource,
    files: safeFiles,
    stats: calculateChangeStats(truncated.diff),
    truncated: truncated.truncated,
    warnings
  };
}

export async function listChangedFiles(workspacePath: string): Promise<string[]> {
  const output = await git(workspacePath, ["status", "--porcelain=v1", "-uall"]);
  const files = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1) ?? "")
    .filter(Boolean);

  return Array.from(new Set(files));
}

export async function getRepositoryName(workspacePath: string): Promise<string> {
  try {
    const topLevel = (await git(workspacePath, ["rev-parse", "--show-toplevel"])).trim();
    return path.basename(topLevel);
  } catch {
    return path.basename(workspacePath);
  }
}

export async function getBranchName(workspacePath: string): Promise<string> {
  try {
    const branch = (await git(workspacePath, ["branch", "--show-current"])).trim();
    return branch.length > 0 ? branch : "detached HEAD";
  } catch {
    return "unknown";
  }
}

export async function detectLanguageHints(files: string[]): Promise<string[]> {
  const hints = new Set<string>();
  const extensionMap = new Map<string, string>([
    [".ts", "TypeScript"],
    [".tsx", "TypeScript"],
    [".js", "JavaScript"],
    [".jsx", "JavaScript"],
    [".py", "Python"],
    [".go", "Go"],
    [".rs", "Rust"],
    [".java", "Java"],
    [".kt", "Kotlin"],
    [".swift", "Swift"],
    [".md", "Markdown"],
    [".json", "JSON"],
    [".yml", "YAML"],
    [".yaml", "YAML"]
  ]);

  for (const file of files) {
    const hint = extensionMap.get(path.extname(file).toLowerCase());
    if (hint) {
      hints.add(hint);
    }
  }

  return Array.from(hints).slice(0, 6);
}

async function ensureGitRepository(workspacePath: string): Promise<void> {
  await git(workspacePath, ["rev-parse", "--is-inside-work-tree"]);
}

async function collectUntrackedFileDiff(
  workspacePath: string,
  safeFiles: string[]
): Promise<string> {
  const status = await git(workspacePath, ["status", "--porcelain=v1", "-uall"]);
  const untrackedFiles = status
    .split(/\r?\n/)
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3))
    .filter(isSafeDiffFile)
    .filter((file) => safeFiles.includes(file));
  const chunks: string[] = [];

  for (const file of untrackedFiles) {
    const fullPath = path.join(workspacePath, file);
    const fileStat = await stat(fullPath).catch(() => undefined);
    if (!fileStat?.isFile() || fileStat.size > 100_000) {
      continue;
    }

    const diff = await git(workspacePath, ["diff", "--no-index", "--", "/dev/null", file]).catch(
      (error: unknown) => {
        if (isGitDiffExitCode(error)) {
          return error.stdout;
        }
        throw error;
      }
    );
    chunks.push(diff);
  }

  return chunks.length > 0 ? `\n${chunks.join("\n")}` : "";
}

function filterDiffBySafeFiles(diff: string, safeFiles: string[]): string {
  if (diff.trim().length === 0) {
    return "";
  }

  const safeSet = new Set(safeFiles);
  const chunks = diff.split(/(?=^diff --git )/m);
  return chunks
    .filter((chunk) => {
      const match = /^diff --git a\/(.+) b\/(.+)$/m.exec(chunk);
      return match ? safeSet.has(match[2]) : true;
    })
    .join("");
}

async function git(workspacePath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: workspacePath,
    maxBuffer: 20 * 1024 * 1024
  });
  return stdout;
}

function isGitDiffExitCode(error: unknown): error is { stdout: string } {
  return typeof error === "object" && error !== null && "stdout" in error;
}
