export interface GenerateCommitRequest {
  token: string;
  model: string;
  fallbackModel: string;
  prompt: string;
}

export interface GenerateCommitResponse {
  content: string;
  modelUsed: string;
}

export interface OpenRouterClientOptions {
  timeoutMs: number;
}

type Fetch = (input: string, init: RequestInit) => Promise<ResponseLike>;

interface ResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  text?: () => Promise<string>;
  json: () => Promise<unknown>;
}

interface OpenRouterChatResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

export class OpenRouterClient {
  private readonly fetchImpl: Fetch;
  private readonly timeoutMs: number;

  constructor(fetchImpl: Fetch = fetch, options: OpenRouterClientOptions = { timeoutMs: 30_000 }) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs =
      Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 30_000;
  }

  async generateCommitMessage(request: GenerateCommitRequest): Promise<GenerateCommitResponse> {
    try {
      return await this.requestModel(request, request.model);
    } catch (primaryError) {
      if (isNonRetryableOpenRouterError(primaryError)) {
        throw primaryError;
      }

      if (request.fallbackModel === request.model) {
        throw primaryError;
      }

      try {
        return await this.requestModel(request, request.fallbackModel);
      } catch (fallbackError) {
        throw new Error(
          `OpenRouter request failed for ${request.model} and ${request.fallbackModel}: ${formatError(
            fallbackError
          )}`
        );
      }
    }
  }

  private async requestModel(
    request: GenerateCommitRequest,
    model: string
  ): Promise<GenerateCommitResponse> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);
    let response: ResponseLike;

    try {
      response = await this.fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: abortController.signal,
        headers: {
          Authorization: `Bearer ${request.token}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/tommyqhoang/CommitCraft-AI-Smart-Git-Commits",
          "X-Title": "CommitCraft AI Smart Git Commits"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: request.prompt
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(`OpenRouter request timed out after ${this.timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const message = formatHttpError(
        response.status,
        response.statusText,
        response.text ? await response.text() : undefined
      );
      throw new OpenRouterHttpError(response.status, message);
    }

    const body = parseChatResponse(await response.json());
    const content = body.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenRouter response did not include message content.");
    }

    return {
      content,
      modelUsed: model
    };
  }
}

function parseChatResponse(value: unknown): OpenRouterChatResponse {
  if (typeof value !== "object" || value === null) {
    throw new Error("OpenRouter response was not an object.");
  }
  return value as OpenRouterChatResponse;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatHttpError(status: number, statusText: string, body?: string): string {
  // For auth errors, never include response body — it may echo back the Authorization header.
  if (status === 401 || status === 403) {
    return `OpenRouter returned ${status}: ${statusText} (authentication error — check your API token)`;
  }

  if (!body) {
    return `OpenRouter returned ${status}: ${statusText}`;
  }

  const sanitized = body
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\r?\n/g, " ")
    .trim();
  const truncated = sanitized.length <= 800 ? sanitized : `${sanitized.slice(0, 797)}...`;
  return `OpenRouter returned ${status}: ${truncated}`;
}

function isNonRetryableOpenRouterError(error: unknown): boolean {
  return error instanceof OpenRouterHttpError && [401, 403].includes(error.status);
}

class OpenRouterHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "OpenRouterHttpError";
  }
}
