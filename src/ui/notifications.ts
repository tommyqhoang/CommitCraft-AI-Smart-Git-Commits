import * as vscode from "vscode";

export function showPlainError(message: string): Thenable<string | undefined> {
  return vscode.window.showErrorMessage(`AI Commit: ${message}`, "Retry");
}

export function showInfo(message: string): Thenable<string | undefined> {
  return vscode.window.showInformationMessage(`AI Commit: ${message}`);
}

export async function confirmAction(message: string, action: string): Promise<boolean> {
  const selected = await vscode.window.showWarningMessage(message, { modal: true }, action);
  return selected === action;
}
