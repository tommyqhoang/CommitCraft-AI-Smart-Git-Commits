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

  it("recovers a plain text response as an editable commit message", () => {
    const parsed = parseCommitResponse("fix: repair token handling\n\nUse SecretStorage only.");

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toBe("fix: repair token handling");
    expect(parsed.message.description).toBe("Use SecretStorage only.");
  });

  it("recovers structured responses with an unsupported commit type", () => {
    const parsed = parseCommitResponse(
      JSON.stringify({
        summary: "oops: invent an unsupported type",
        description: "Uses a type outside the documented commit convention."
      })
    );

    expect(parsed.recovered).toBe(true);
    expect(parsed.message.summary).toBe("chore: update project");
    expect(parsed.recoveryReason).toContain("unsupported commit type");
  });
});
