import * as vscode from "vscode";

import { clearOpenRouterToken } from "./commands/clearOpenRouterToken";
import { generateCommitMessage } from "./commands/generateCommitMessage";
import { setOpenRouterToken } from "./commands/setOpenRouterToken";

export function activate(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "commitCraft.openCommitAssistant";
  statusBarItem.text = "$(sparkle) CommitCraft";
  statusBarItem.tooltip = "Open CommitCraft commit assistant";
  statusBarItem.show();

  let activePanel: vscode.WebviewPanel | undefined;

  const openCommitAssistant = async () => {
    if (activePanel) {
      activePanel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = await generateCommitMessage(context);
    if (panel) {
      activePanel = panel;
      panel.onDidDispose(() => {
        activePanel = undefined;
      });
    }
  };

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand("commitCraft.openCommitAssistant", openCommitAssistant),
    vscode.commands.registerCommand("commitCraft.generateCommitMessage", openCommitAssistant),
    vscode.commands.registerCommand("commitCraft.setOpenRouterToken", () =>
      setOpenRouterToken(context)
    ),
    vscode.commands.registerCommand("commitCraft.clearOpenRouterToken", () =>
      clearOpenRouterToken(context)
    )
  );
}

export function deactivate(): void {}
