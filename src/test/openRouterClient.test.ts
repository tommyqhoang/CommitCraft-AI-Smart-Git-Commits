import { describe, expect, it, vi } from "vitest";

import { OpenRouterClient } from "../openrouter/openRouterClient";

describe("OpenRouterClient", () => {
  it("uses the fallback model when the primary model request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "model unavailable"
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

  it("does not retry with the fallback model when the token is unauthorized", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid token"
    });
    const client = new OpenRouterClient(fetchMock);

    await expect(
      client.generateCommitMessage({
        token: "secret-token",
        model: "openrouter/auto",
        fallbackModel: "openrouter/free",
        prompt: "prompt text"
      })
    ).rejects.toThrow("OpenRouter returned 401");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts requests that exceed the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new Error("request aborted"));
          });
        })
    );
    const client = new OpenRouterClient(fetchMock, { timeoutMs: 10 });

    const request = client.generateCommitMessage({
      token: "secret-token",
      model: "openrouter/auto",
      fallbackModel: "openrouter/auto",
      prompt: "prompt text"
    });

    const expectation = expect(request).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10);
    await expectation;
    vi.useRealTimers();
  });
});
