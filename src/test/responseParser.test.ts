import { describe, expect, it } from "vitest";

import { parseCommitResponse } from "../openrouter/responseParser";

describe("parseCommitResponse", () => {
  it("parses and validates structured OpenRouter JSON", () => {
    const parsed = parseCommitResponse(
      JSON.stringify({
        summary: "feat: add ai commit workflow",
        description: "Adds the command, prompt, and review flow.",
        riskLevel: "low",
        changeStats: {
          filesChanged: 2,
          linesAdded: 120,
          linesRemoved: 12
        },
        notableFiles: ["src/extension.ts"]
      })
    );

    expect(parsed.recovered).toBe(false);
    expect(parsed.message.summary).toBe("feat: add ai commit workflow");
    expect(parsed.message.riskLevel).toBe("low");
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    const parsed = parseCommitResponse(`\`\`\`json
{"summary":"fix: parse fenced json","description":"Works with fenced responses.","riskLevel":"medium"}
\`\`\``);

    expect(parsed.recovered).toBe(false);
    expect(parsed.message.summary).toBe("fix: parse fenced json");
    expect(parsed.message.riskLevel).toBe("medium");
  });

  it("recovers a plain text response as an editable commit message", () => {
    const parsed = parseCommitResponse("fix: repair token handling\n\nUse SecretStorage only.");

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toBe("fix: repair token handling");
    expect(parsed.message.description).toBe("Use SecretStorage only.");
  });

  it("recovers structured responses with an unsupported commit type, preserving content", () => {
    const parsed = parseCommitResponse(
      JSON.stringify({
        summary: "oops: invent an unsupported type",
        description: "Uses a type outside the documented commit convention."
      })
    );

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toBe("chore: invent an unsupported type");
    expect(parsed.message.description).toBe(
      "Uses a type outside the documented commit convention."
    );
    expect(parsed.recoveryReason).toContain("unsupported commit type");
  });

  it("falls back to a safe message for malformed JSON-looking responses", () => {
    const parsed = parseCommitResponse('{"summary":');

    expect(parsed.recovered).toBe(true);
    expect(parsed.message).toEqual({
      summary: "chore: update project",
      description: "",
      riskLevel: "medium"
    });
    expect(parsed.recoveryReason).toBeTruthy();
  });

  it("recovers non-object JSON as plain text", () => {
    const parsed = parseCommitResponse("null");

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toBe("chore: null");
    expect(parsed.recoveryReason).toContain("not a JSON object");
  });

  it("falls back when JSON is missing a non-empty summary", () => {
    const parsed = parseCommitResponse(JSON.stringify({ summary: "   ", description: "x" }));

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toBe("chore: update project");
    expect(parsed.recoveryReason).toContain("missing summary");
  });

  it("defaults invalid risk levels and non-string descriptions", () => {
    const parsed = parseCommitResponse(
      JSON.stringify({
        summary: "fix: normalize metadata",
        description: 42,
        riskLevel: "extreme"
      })
    );

    expect(parsed.recovered).toBe(false);
    expect(parsed.message.description).toBe("");
    expect(parsed.message.riskLevel).toBe("low");
  });

  it("accepts scoped commit types like feat(ui): without recovery", () => {
    const parsed = parseCommitResponse(
      JSON.stringify({
        summary: "feat(ui): improve commit panel layout",
        description: "Adds stat strip and timeline.",
        riskLevel: "low"
      })
    );

    expect(parsed.recovered).toBe(false);
    expect(parsed.message.summary).toBe("feat(ui): improve commit panel layout");
  });

  it("accepts breaking change notation feat!: without recovery", () => {
    const parsed = parseCommitResponse(
      JSON.stringify({
        summary: "feat!: drop notableFiles from commit message schema",
        description: "Removes dead field from the AI response contract.",
        riskLevel: "high"
      })
    );

    expect(parsed.recovered).toBe(false);
    expect(parsed.message.summary).toBe("feat!: drop notableFiles from commit message schema");
  });

  it("prepends chore: when plain text recovery produces a summary without a type prefix", () => {
    const parsed = parseCommitResponse("Improve the file list rendering");

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toMatch(/^chore: /);
  });

  it("uses a default plain-text summary when the response is blank", () => {
    const parsed = parseCommitResponse("");

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toBe("chore: update project");
  });

  it("truncates very long summaries during normalization", () => {
    const parsed = parseCommitResponse(
      JSON.stringify({
        summary: `fix: ${"x".repeat(140)}`,
        description: "",
        riskLevel: "low"
      })
    );

    expect(parsed.message.summary).toHaveLength(100);
    expect(parsed.message.summary.endsWith("...")).toBe(true);
  });
});
