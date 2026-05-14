import { describe, expect, it, vi } from "vitest";

import { readSettingsFromConfig, type ConfigReader } from "../config/settings";

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
      skipCommitConfirmation: false
    });
  });

  it("skipCommitConfirmation defaults to false", () => {
    const config: ConfigReader = { get: vi.fn().mockReturnValue(undefined) };
    const settings = readSettingsFromConfig(config);
    expect(settings.skipCommitConfirmation).toBe(false);
  });

  it("skipCommitConfirmation reads true from config", () => {
    const config: ConfigReader = {
      get: vi.fn((key: string) => (key === "skipCommitConfirmation" ? true : undefined))
    };
    const settings = readSettingsFromConfig(config);
    expect(settings.skipCommitConfirmation).toBe(true);
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

  it("falls back to the default diff limit when the configured value is not finite", () => {
    const settings = readSettingsFromConfig({
      get: (key) => (key === "maxDiffCharacters" ? Number.NaN : undefined) as never
    });

    expect(settings.maxDiffCharacters).toBe(60_000);
  });

  it("clamps maxDiffCharacters to the upper bound of 200 000", () => {
    const settings = readSettingsFromConfig({
      get: (key) => (key === "maxDiffCharacters" ? 999_999 : undefined) as never
    });

    expect(settings.maxDiffCharacters).toBe(200_000);
  });
});
