import * as vscode from "vscode";

import { openRouterTokenSecretKey } from "../config/settings";
import { showInfo } from "../ui/notifications";

export async function setOpenRouterToken(context: vscode.ExtensionContext): Promise<void> {
  const token = await vscode.window.showInputBox({
    title: "Set OpenRouter API Token",
    prompt: "Paste your OpenRouter API token. It will be stored in VS Code SecretStorage.",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? "Token cannot be empty." : undefined)
  });

  if (!token) {
    return;
  }

  await context.secrets.store(openRouterTokenSecretKey, token.trim());
  await showInfo("OpenRouter API token saved.");
}
