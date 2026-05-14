import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { calculateChangeStats, type ChangeStats } from "./changeStats";

const execFileAsync = promisify(execFile);

const unsafeFilePatterns: { pattern: RegExp; reason: ExcludedFileReason }[] = [
  { pattern: /^\.env(?:\.|$)/i, reason: "secret-like file" },
  { pattern: /(^|\/)\.env(?:\.|$)/i, reason: "secret-like file" },
  {
    pattern: /(^|\/)(?:secret|secrets|credential|credentials|token|tokens)(?:\/|\.|$)/i,
    reason: "secret-like file"
  },
  { pattern: /\.(?:key|pem|p12|pfx|crt|cer|der)$/i, reason: "secret-like file" },
  {
    pattern:
      /\.(?:png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tar|tgz|7z|mp4|mov|mp3|wav|woff2?|ttf|otf)$/i,
    reason: "binary or generated asset"
  },
  {
    pattern: /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i,
    reason: "lockfile"
  }
];

export type DiffSource = "staged" | "unstaged";

export interface TruncatedDiff {
  diff: string;
  truncated: boolean;
}

export interface FileLineStat {
  added: number;
  removed: number;
}

export interface DiffContext {
  diff: string;
  fullDiff: string;
  diffSource: DiffSource;
  files: string[];
  excludedFiles: ExcludedDiffFile[];
  fileStats: Record<string, FileLineStat>;
  stats: ChangeStats;
  truncated: boolean;
  warnings: string[];
  maxDiffCharacters: number;
}

export function parseNumstat(output: string): Record<string, FileLineStat> {
  const result: Record<string, FileLineStat> = {};
  for (const line of output.split("\n")) {
    const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.trim());
    if (match) {
      result[match[3]] = {
        added: match[1] === "-" ? 0 : parseInt(match[1], 10),
        removed: match[2] === "-" ? 0 : parseInt(match[2], 10)
      };
    }
  }
  return result;
}

export type ExcludedFileReason =
  | "secret-like file"
  | "binary or generated asset"
  | "lockfile"
  | "file too large"
  | "unsupported file type";

export interface ExcludedDiffFile {
  path: string;
  reason: ExcludedFileReason;
}

export interface DiffCollectorOptions {
  includeUntrackedFiles: boolean;
  maxDiffCharacters: number;
}

export function isSafeDiffFile(filePath: string): boolean {
  return getExcludedFileReason(filePath) === undefined;
}

export function getExcludedFileReason(filePath: string): ExcludedFileReason | undefined {
  const normalized = filePath.replaceAll("\\", "/");
  return unsafeFilePatterns.find(({ pattern }) => pattern.test(normalized))?.reason;
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
  const trackedUnstagedDiff = hasStaged
    ? ""
    : await git(workspacePath, ["diff", "--no-ext-diff", "--"]);
  const statusFiles = hasStaged
    ? await listStagedFiles(workspacePath)
    : await listUncommittedFiles(workspacePath, options.includeUntrackedFiles);
  const unsafeUntrackedFiles = hasStaged
    ? new Map<string, ExcludedFileReason>()
    : await listUnsafeUntrackedFiles(workspacePath, statusFiles);
  const safeFiles = statusFiles.filter(
    (file) => isSafeDiffFile(file) && !unsafeUntrackedFiles.has(file)
  );
  const excludedFiles = statusFiles
    .map((file) => {
      const reason = getExcludedFileReason(file) ?? unsafeUntrackedFiles.get(file);
      return reason ? { path: file, reason } : undefined;
    })
    .filter((file): file is ExcludedDiffFile => file !== undefined)
    .sort((a, b) => a.path.localeCompare(b.path));
  const warnings: string[] = [];

  if (safeFiles.length < statusFiles.length) {
    warnings.push(
      "Some ignored, binary, lock, oversized, or secret-like files were excluded from the prompt."
    );
  }

  const untrackedDiff =
    !hasStaged && options.includeUntrackedFiles
      ? await collectUntrackedFileDiff(workspacePath, safeFiles)
      : "";
  const filteredDiff = filterDiffBySafeFiles(
    `${hasStaged ? stagedDiff : trackedUnstagedDiff}${untrackedDiff}`,
    safeFiles
  );
  const stats = calculateChangeStats(filteredDiff);
  const truncated = truncateDiff(filteredDiff, options.maxDiffCharacters);

  if (truncated.truncated) {
    warnings.push(`Diff was truncated to ${options.maxDiffCharacters} characters.`);
  }

  const numstatArgs = hasStaged
    ? ["diff", "--cached", "--numstat", "--"]
    : ["diff", "--numstat", "--"];
  const allFileStats = parseNumstat(await git(workspacePath, numstatArgs).catch(() => ""));
  const safeSet = new Set(safeFiles);
  const fileStats: Record<string, FileLineStat> = {};
  for (const [file, stat] of Object.entries(allFileStats)) {
    if (safeSet.has(file)) {
      fileStats[file] = stat;
    }
  }

  return {
    diff: truncated.diff,
    fullDiff: filteredDiff,
    diffSource,
    files: safeFiles,
    excludedFiles,
    fileStats,
    stats,
    truncated: truncated.truncated,
    warnings,
    maxDiffCharacters: options.maxDiffCharacters
  };
}

export function filterDiffContextToFiles(
  context: DiffContext,
  selectedFiles: string[]
): DiffContext {
  const selectedSet = new Set(selectedFiles);
  const files = context.files.filter((file) => selectedSet.has(file));
  const fullDiff = filterDiffBySafeFiles(context.fullDiff, files);
  const truncated = truncateDiff(fullDiff, context.maxDiffCharacters);

  const warnings = context.warnings.filter((w) => !w.startsWith("Diff was truncated"));
  if (truncated.truncated) {
    warnings.push(`Diff was truncated to ${context.maxDiffCharacters} characters.`);
  }

  const filteredFileStats: Record<string, FileLineStat> = {};
  for (const file of files) {
    if (context.fileStats[file]) {
      filteredFileStats[file] = context.fileStats[file];
    }
  }

  return {
    ...context,
    diff: truncated.diff,
    fullDiff,
    files,
    fileStats: filteredFileStats,
    stats: calculateChangeStats(fullDiff),
    truncated: truncated.truncated,
    warnings
  };
}

async function listStagedFiles(workspacePath: string): Promise<string[]> {
  return parseNullDelimited(
    await git(workspacePath, ["diff", "--cached", "--name-only", "-z", "--"])
  );
}

async function listUncommittedFiles(
  workspacePath: string,
  includeUntrackedFiles: boolean
): Promise<string[]> {
  const trackedFiles = parseNullDelimited(
    await git(workspacePath, ["diff", "--name-only", "-z", "--"])
  );
  const untrackedFiles = includeUntrackedFiles ? await listUntrackedFiles(workspacePath) : [];

  return Array.from(new Set([...trackedFiles, ...untrackedFiles]));
}

async function listUntrackedFiles(workspacePath: string): Promise<string[]> {
  return parseNullDelimited(
    await git(workspacePath, ["ls-files", "--others", "--exclude-standard", "-z"])
  );
}

async function listUnsafeUntrackedFiles(
  workspacePath: string,
  statusFiles: string[]
): Promise<Map<string, ExcludedFileReason>> {
  const untrackedSet = new Set(await listUntrackedFiles(workspacePath));
  const unsafeFiles = new Map<string, ExcludedFileReason>();

  for (const file of statusFiles) {
    if (!untrackedSet.has(file) || !isSafeDiffFile(file)) {
      continue;
    }

    const fileStat = await lstat(path.join(workspacePath, file)).catch(() => undefined);
    if (!fileStat?.isFile()) {
      unsafeFiles.set(file, "unsupported file type");
      continue;
    }

    if (fileStat.size > 100_000) {
      unsafeFiles.set(file, "file too large");
    }
  }

  return unsafeFiles;
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
  const safeSet = new Set(safeFiles);
  const untrackedFiles = (await listUntrackedFiles(workspacePath)).filter((file) =>
    safeSet.has(file)
  );
  const chunks: string[] = [];

  for (const file of untrackedFiles) {
    const fullPath = path.join(workspacePath, file);
    const fileStat = await lstat(fullPath).catch(() => undefined);
    if (!fileStat?.isFile() || fileStat.size > 100_000) {
      continue;
    }

    const diff = await git(workspacePath, ["diff", "--no-index", "--", os.devNull, file]).catch(
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

function parseNullDelimited(output: string): string[] {
  return output.split("\0").filter(Boolean);
}

function filterDiffBySafeFiles(diff: string, safeFiles: string[]): string {
  if (diff.trim().length === 0) {
    return "";
  }

  const safeSet = new Set(safeFiles);
  const chunks = diff.split(/(?=^diff --git )/m);
  return chunks
    .filter((chunk) => {
      if (chunk.trim().length === 0) return false;
      const match = /^diff --git a\/(.+) b\/(.+)$/m.exec(chunk);
      return match ? safeSet.has(match[2]) : false; // drop unattributable chunks
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

function isGitDiffExitCode(error: unknown): error is { stdout: string; code: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "stdout" in error &&
    "code" in error &&
    (error as { code: unknown }).code === 1
  );
}
