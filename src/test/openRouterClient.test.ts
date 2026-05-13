import { describe, expect, it, vi } from "vitest";

import { OpenRouterClient } from "../openrouter/openRouterClient";

describe("OpenRouterClient", () => {
  it("uses the fallback model when the primary model request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "invalid token"
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: '{"summary":"fix: retry","description":"Adds fallback."}' } }
          ]
        })
      });
    const client = new OpenRouterClient(fetchMock);

    const response = await client.generateCommitMessage({
      token: "secret-token",
      model: "openrouter/auto",
      fallbackModel: "openrouter/free",
      prompt: "prompt text"
    });

    expect(response.modelUsed).toBe("openrouter/free");
    expect(response.content).toContain("fix: retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers.Authorization).toBe("Bearer secret-token");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("openrouter/auto");
  });
});
