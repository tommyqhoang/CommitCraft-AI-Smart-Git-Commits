import * as vscode from "vscode";

export function showPlainError(message: string): Thenable<string | undefined> {
  return vscode.window.showErrorMessage(`CommitCraft: ${message}`);
}

export function showRetryableError(message: string): Thenable<string | undefined> {
  return vscode.window.showErrorMessage(`CommitCraft: ${message}`, "Retry");
}

export function showInfo(message: string): Thenable<string | undefined> {
  return vscode.window.showInformationMessage(`CommitCraft: ${message}`);
}

export async function confirmAction(message: string, action: string): Promise<boolean> {
  const selected = await vscode.window.showWarningMessage(message, { modal: true }, action);
  return selected === action;
}
