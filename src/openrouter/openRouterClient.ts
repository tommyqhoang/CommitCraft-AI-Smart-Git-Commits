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

  constructor(fetchImpl: Fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async generateCommitMessage(request: GenerateCommitRequest): Promise<GenerateCommitResponse> {
    try {
      return await this.requestModel(request, request.model);
    } catch (primaryError) {
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
    const response = await this.fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.token}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/local-dev/ai-commit-vscode-extension",
        "X-Title": "AI Commit VS Code Extension"
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

    if (!response.ok) {
      const details = response.text ? await response.text() : response.statusText;
      throw new Error(`OpenRouter returned ${response.status}: ${details || response.statusText}`);
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
