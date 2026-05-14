import { describe, expect, it } from "vitest";

import { CommitCraftError, GitOperationError, NetworkError, UserInputError } from "../errors";

describe("CommitCraftError hierarchy", () => {
  it("carries a userMessage separate from the internal message", () => {
    const err = new CommitCraftError("User-facing text", "Internal details");
    expect(err.userMessage).toBe("User-facing text");
    expect(err.message).toBe("Internal details");
    expect(err.name).toBe("CommitCraftError");
    expect(err instanceof Error).toBe(true);
  });

  it("uses userMessage as message when no internal message is provided", () => {
    const err = new CommitCraftError("Only message");
    expect(err.userMessage).toBe("Only message");
    expect(err.message).toBe("Only message");
  });

  it("GitOperationError is a CommitCraftError and Error", () => {
    const err = new GitOperationError("Push rejected", "raw stderr");
    expect(err instanceof CommitCraftError).toBe(true);
    expect(err instanceof GitOperationError).toBe(true);
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe("GitOperationError");
    expect(err.userMessage).toBe("Push rejected");
    expect(err.message).toBe("raw stderr");
  });

  it("NetworkError is a CommitCraftError and Error", () => {
    const err = new NetworkError("Request timed out", "raw timeout");
    expect(err instanceof CommitCraftError).toBe(true);
    expect(err instanceof NetworkError).toBe(true);
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe("NetworkError");
    expect(err.userMessage).toBe("Request timed out");
  });

  it("UserInputError is a CommitCraftError with userMessage === message", () => {
    const err = new UserInputError("Select at least one file.");
    expect(err instanceof CommitCraftError).toBe(true);
    expect(err instanceof UserInputError).toBe(true);
    expect(err.name).toBe("UserInputError");
    expect(err.userMessage).toBe("Select at least one file.");
    expect(err.message).toBe("Select at least one file.");
  });

  it("subclasses are not instanceof each other", () => {
    const gitErr = new GitOperationError("git error");
    const netErr = new NetworkError("net error");
    const userErr = new UserInputError("user error");
    expect(gitErr instanceof NetworkError).toBe(false);
    expect(gitErr instanceof UserInputError).toBe(false);
    expect(netErr instanceof GitOperationError).toBe(false);
    expect(netErr instanceof UserInputError).toBe(false);
    expect(userErr instanceof GitOperationError).toBe(false);
    expect(userErr instanceof NetworkError).toBe(false);
  });

  it("CommitCraftError can be caught by instanceof CommitCraftError regardless of subclass", () => {
    const errors: CommitCraftError[] = [
      new GitOperationError("g"),
      new NetworkError("n"),
      new UserInputError("u")
    ];
    for (const err of errors) {
      expect(err instanceof CommitCraftError).toBe(true);
    }
  });
});
