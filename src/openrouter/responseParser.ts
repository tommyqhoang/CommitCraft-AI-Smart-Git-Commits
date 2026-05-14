export type RiskLevel = "low" | "medium" | "high";

const allowedCommitTypes = new Set([
  "feat",
  "fix",
  "docs",
  "refactor",
  "test",
  "chore",
  "build",
  "ci",
  "style",
  "perf",
  "revert"
]);

export interface GeneratedCommitMessage {
  summary: string;
  description: string;
  riskLevel: RiskLevel;
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
    const { message, typeCoerced } = validateMessage(parsed);
    if (typeCoerced) {
      return {
        message,
        recovered: true,
        recoveryReason: "OpenRouter response used an unsupported commit type."
      };
    }
    return { message, recovered: false };
  } catch (error) {
    const recovered = looksLikeJson(trimmed) ? fallbackMessage() : recoverPlainText(trimmed);
    return {
      message: recovered,
      recovered: true,
      recoveryReason: error instanceof Error ? error.message : "Invalid JSON response"
    };
  }
}

function validateMessage(value: unknown): { message: GeneratedCommitMessage; typeCoerced: boolean } {
  if (!isRecord(value)) {
    throw new Error("OpenRouter response was not a JSON object.");
  }

  const rawSummary = readRequiredString(value, "summary");
  const { summary: coerced, typeCoerced } = coerceCommitType(rawSummary);
  const summary = normalizeSummary(coerced);
  const description = readOptionalString(value, "description");
  const riskLevelValue = readOptionalString(value, "riskLevel") || "low";
  const riskLevel: RiskLevel = ["low", "medium", "high"].includes(riskLevelValue)
    ? (riskLevelValue as RiskLevel)
    : "low";
  return {
    message: { summary, description, riskLevel },
    typeCoerced
  };
}

function recoverPlainText(content: string): GeneratedCommitMessage {
  const [firstLine = "", ...rest] = content.split(/\r?\n/);
  const line = firstLine.trim() || "chore: update project";
  const hasType = /^[a-z]+(?:\([^)]*\))?!?:\s+\S/.test(line);
  return {
    summary: normalizeSummary(hasType ? line : `chore: ${line}`),
    description: rest.join("\n").trim(),
    riskLevel: "medium"
  };
}

function fallbackMessage(): GeneratedCommitMessage {
  return {
    summary: "chore: update project",
    description: "",
    riskLevel: "medium"
  };
}

function stripCodeFence(content: string): string {
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content);
  return fenceMatch?.[1]?.trim() ?? content;
}

function looksLikeJson(content: string): boolean {
  return content.startsWith("{") || content.startsWith("[");
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

function normalizeSummary(summary: string): string {
  const trimmed = summary.trim();
  return trimmed.length > 100 ? trimmed.slice(0, 97).trimEnd() + "..." : trimmed;
}

function coerceCommitType(summary: string): { summary: string; typeCoerced: boolean } {
  const match = /^([a-z]+)((?:\([^)]*\))?!?): /i.exec(summary);
  if (!match) {
    return { summary, typeCoerced: false };
  }
  const [, type, scopeAndBreaking] = match;
  if (allowedCommitTypes.has(type.toLowerCase())) {
    return { summary, typeCoerced: false };
  }
  return {
    summary: `chore${scopeAndBreaking}: ${summary.slice(match[0].length)}`,
    typeCoerced: true
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
