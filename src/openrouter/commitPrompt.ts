import type { ChangeStats } from "../git/changeStats";
import type { DiffSource } from "../git/diffCollector";

export interface CommitPromptInput {
  repositoryName: string;
  branchName: string;
  diff: string;
  diffSource: DiffSource;
  files: string[];
  stats: ChangeStats;
  languageHints: string[];
  truncated: boolean;
}

export function buildCommitPrompt(input: CommitPromptInput): string {
  const fileList =
    input.files.length > 0 ? input.files.map((file) => `- ${file}`).join("\n") : "- none";
  const languages =
    input.languageHints.length > 0 ? input.languageHints.join(", ") : "No cheap language hints";

  return [
    "You are generating a high-quality Git commit message.",
    "Return only valid JSON. Do not wrap the JSON in markdown.",
    "",
    "Required JSON shape:",
    "{",
    '  "summary": "<type>: <short summary>",',
    '  "description": "<one or two concise sentences>",',
    '  "riskLevel": "low|medium|high",',
    '  "changeStats": { "filesChanged": 0, "linesAdded": 0, "linesRemoved": 0 },',
    '  "notableFiles": ["path/from/diff"]',
    "}",
    "",
    "Rules:",
    "- Use one of: feat, fix, docs, refactor, test, chore, build, ci.",
    "- Prefer the most user-visible intent when the diff is mixed.",
    "- Keep the summary under 72 characters when possible.",
    "- Do not mention tools, prompts, or OpenRouter unless the diff changes them.",
    "",
    `Repository: ${input.repositoryName}`,
    `Branch: ${input.branchName}`,
    `Diff source: ${input.diffSource}`,
    `Languages: ${languages}`,
    `Files changed: ${input.stats.filesChanged}`,
    `Lines added: ${input.stats.linesAdded}`,
    `Lines removed: ${input.stats.linesRemoved}`,
    `Diff truncated: ${input.truncated ? "yes" : "no"}`,
    "",
    "Changed files:",
    fileList,
    "",
    "Diff:",
    input.diff
  ].join("\n");
}
