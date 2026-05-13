import * as vscode from "vscode";

import { openRouterTokenSecretKey } from "../config/settings";
import { showInfo } from "../ui/notifications";

export async function clearOpenRouterToken(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(openRouterTokenSecretKey);
  await showInfo("OpenRouter API token cleared.");
}
