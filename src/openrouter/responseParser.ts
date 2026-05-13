import type { ChangeStats } from "../git/changeStats";

export type RiskLevel = "low" | "medium" | "high";

export interface GeneratedCommitMessage {
  summary: string;
  description: string;
  riskLevel: RiskLevel;
  changeStats?: ChangeStats;
  notableFiles: string[];
}

export interface ParsedCommitResponse {
  message: GeneratedCommitMessage;
  recovered: boolean;
  recoveryReason?: string;
}

export function parseCommitResponse(content: string): ParsedCommitResponse {
  const trimmed = stripCodeFence(content.trim());

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return {
      message: validateMessage(parsed),
      recovered: false
    };
  } catch (error) {
    const recovered = recoverPlainText(trimmed);
    return {
      message: recovered,
      recovered: true,
      recoveryReason: error instanceof Error ? error.message : "Invalid JSON response"
    };
  }
}

function validateMessage(value: unknown): GeneratedCommitMessage {
  if (!isRecord(value)) {
    throw new Error("OpenRouter response was not a JSON object.");
  }

  const summary = readRequiredString(value, "summary");
  const description = readOptionalString(value, "description");
  const riskLevelValue = readOptionalString(value, "riskLevel") || "low";
  const riskLevel: RiskLevel = ["low", "medium", "high"].includes(riskLevelValue)
    ? (riskLevelValue as RiskLevel)
    : "low";
  const notableFilesValue = value.notableFiles;
  const notableFiles = Array.isArray(notableFilesValue)
    ? notableFilesValue.filter((file): file is string => typeof file === "string")
    : [];

  return {
    summary: normalizeSummary(summary),
    description,
    riskLevel,
    changeStats: readStats(value.changeStats),
    notableFiles
  };
}

function recoverPlainText(content: string): GeneratedCommitMessage {
  const [summaryLine = "chore: update project", ...descriptionLines] = content.split(/\r?\n/);
  return {
    summary: normalizeSummary(summaryLine),
    description: descriptionLines.join("\n").trim(),
    riskLevel: "medium",
    notableFiles: []
  };
}

function stripCodeFence(content: string): string {
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content);
  return fenceMatch?.[1]?.trim() ?? content;
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`OpenRouter response is missing ${key}.`);
  }
  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStats(value: unknown): ChangeStats | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const filesChanged = readNumber(value.filesChanged);
  const linesAdded = readNumber(value.linesAdded);
  const linesRemoved = readNumber(value.linesRemoved);

  if (filesChanged === undefined || linesAdded === undefined || linesRemoved === undefined) {
    return undefined;
  }

  return { filesChanged, linesAdded, linesRemoved };
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeSummary(summary: string): string {
  const trimmed = summary.trim();
  return trimmed.length > 100 ? trimmed.slice(0, 97).trimEnd() + "..." : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
