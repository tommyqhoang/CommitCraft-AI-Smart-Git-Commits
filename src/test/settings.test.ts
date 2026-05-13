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
      autoPushAfterCommit: false
    });
  });
});
