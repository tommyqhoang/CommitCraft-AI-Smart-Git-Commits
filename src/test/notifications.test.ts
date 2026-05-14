import { describe, expect, it, vi, beforeEach } from "vitest";

import * as vscode from "vscode";

import { confirmAction, showInfo, showPlainError, showRetryableError } from "../ui/notifications";
import { resetVscodeMocks } from "./mocks/vscode";

beforeEach(() => {
  resetVscodeMocks();
});

describe("showPlainError", () => {
  it("calls showErrorMessage with CommitCraft prefix", async () => {
    await showPlainError("something went wrong");
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "CommitCraft: something went wrong"
    );
  });

  it("returns undefined when no button is clicked", async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
    const result = await showPlainError("error");
    expect(result).toBeUndefined();
  });
});

describe("showRetryableError", () => {
  it("calls showErrorMessage with Retry button", async () => {
    await showRetryableError("network failed");
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "CommitCraft: network failed",
      "Retry"
    );
  });

  it("returns 'Retry' when user clicks Retry", async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue("Retry" as never);
    const result = await showRetryableError("network failed");
    expect(result).toBe("Retry");
  });

  it("returns undefined when user dismisses without clicking Retry", async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
    const result = await showRetryableError("network failed");
    expect(result).toBeUndefined();
  });
});

describe("showInfo", () => {
  it("calls showInformationMessage with CommitCraft prefix", async () => {
    await showInfo("commit created");
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "CommitCraft: commit created"
    );
  });
});

describe("confirmAction", () => {
  it("returns true when user clicks the action button", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Push" as never);
    const result = await confirmAction("Push main to origin?", "Push");
    expect(result).toBe(true);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "Push main to origin?",
      { modal: true },
      "Push"
    );
  });

  it("returns false when user dismisses the dialog", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
    const result = await confirmAction("Push?", "Push");
    expect(result).toBe(false);
  });

  it("returns false when showWarningMessage returns a different string", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue("Other" as never);
    const result = await confirmAction("Push?", "Push");
    expect(result).toBe(false);
  });
});
