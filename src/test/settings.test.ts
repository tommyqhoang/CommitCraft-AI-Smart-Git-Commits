import { describe, expect, it } from "vitest";

import { readSettingsFromConfig } from "../config/settings";

describe("readSettingsFromConfig", () => {
  it("uses documented defaults when settings are absent", () => {
    const settings = readSettingsFromConfig({
      get: () => undefined
    });

    expect(settings).toEqual({
      openRouterModel: "openrouter/auto",
      fallbackModel: "openrouter/free",
      maxDiffCharacters: 60000,
      includeUntrackedFiles: true,
      showCommitAndPush: false
    });
  });

  it("normalizes blank models and clamps the diff limit", () => {
    const settings = readSettingsFromConfig({
      get: (key) => {
        const values = new Map<string, unknown>([
          ["openRouterModel", "  "],
          ["fallbackModel", " openrouter/free "],
          ["maxDiffCharacters", 10]
        ]);
        return values.get(key) as never;
      }
    });

    expect(settings.openRouterModel).toBe("openrouter/auto");
    expect(settings.fallbackModel).toBe("openrouter/free");
    expect(settings.maxDiffCharacters).toBe(1000);
  });
});
