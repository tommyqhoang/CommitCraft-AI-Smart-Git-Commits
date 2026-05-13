import assert from "node:assert";

import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("tommyqhoang.commitcraft-ai-smart-git-commits");

  assert.ok(extension, "Expected CommitCraft extension to be discoverable");
  await extension.activate();

  const commands = await vscode.commands.getCommands(true);

  assert.ok(commands.includes("commitCraft.generateCommitMessage"));
  assert.ok(commands.includes("commitCraft.setOpenRouterToken"));
  assert.ok(commands.includes("commitCraft.clearOpenRouterToken"));
}
