import * as vscode from "vscode";

import { readSettingsFromConfig, type AiCommitSettings } from "./settings";

export function getAiCommitSettings(): AiCommitSettings {
  return readSettingsFromConfig(vscode.workspace.getConfiguration("aiCommit"));
}
