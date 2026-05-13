import * as vscode from "vscode";

import { clearOpenRouterToken } from "./commands/clearOpenRouterToken";
import { generateCommitMessage } from "./commands/generateCommitMessage";
import { setOpenRouterToken } from "./commands/setOpenRouterToken";

export function activate(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "aiCommit.generateCommitMessage";
  statusBarItem.text = "$(sparkle) AI Commit";
  statusBarItem.tooltip = "Generate an AI commit message from Git changes";
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand("aiCommit.generateCommitMessage", () =>
      generateCommitMessage(context)
    ),
    vscode.commands.registerCommand("aiCommit.setOpenRouterToken", () =>
      setOpenRouterToken(context)
    ),
    vscode.commands.registerCommand("aiCommit.clearOpenRouterToken", () =>
      clearOpenRouterToken(context)
    )
  );
}

export function deactivate(): void {}
