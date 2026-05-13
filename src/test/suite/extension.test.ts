import assert from "node:assert";

import * as vscode from "vscode";

suite("AI Commit extension", () => {
  test("registers public commands", async () => {
    const extension = vscode.extensions.getExtension("local-dev.ai-commit-vscode-extension");

    assert.ok(extension, "Expected AI Commit extension to be discoverable");
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes("aiCommit.generateCommitMessage"));
    assert.ok(commands.includes("aiCommit.setOpenRouterToken"));
    assert.ok(commands.includes("aiCommit.clearOpenRouterToken"));
  });
});
