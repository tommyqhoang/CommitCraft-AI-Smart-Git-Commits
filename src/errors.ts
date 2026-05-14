export class CommitCraftError extends Error {
  constructor(
    readonly userMessage: string,
    message?: string
  ) {
    super(message ?? userMessage);
    this.name = "CommitCraftError";
  }
}

export class GitOperationError extends CommitCraftError {
  constructor(userMessage: string, message?: string) {
    super(userMessage, message);
    this.name = "GitOperationError";
  }
}

export class NetworkError extends CommitCraftError {
  constructor(userMessage: string, message?: string) {
    super(userMessage, message);
    this.name = "NetworkError";
  }
}

export class UserInputError extends CommitCraftError {
  constructor(userMessage: string) {
    super(userMessage);
    this.name = "UserInputError";
  }
}
