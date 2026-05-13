import * as vscode from "vscode";

import { clearOpenRouterToken } from "./commands/clearOpenRouterToken";
import { generateCommitMessage } from "./commands/generateCommitMessage";
import { setOpenRouterToken } from "./commands/setOpenRouterToken";

export function activate(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "commitCraft.generateCommitMessage";
  statusBarItem.text = "$(sparkle) CommitCraft";
  statusBarItem.tooltip = "Generate a smart Git commit message from local changes";
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand("commitCraft.generateCommitMessage", () =>
      generateCommitMessage(context)
    ),
    vscode.commands.registerCommand("commitCraft.setOpenRouterToken", () =>
      setOpenRouterToken(context)
    ),
    vscode.commands.registerCommand("commitCraft.clearOpenRouterToken", () =>
      clearOpenRouterToken(context)
    )
  );
}

export function deactivate(): void {}
