import { describe, expect, it } from "vitest";

import { selectWorkspacePath } from "../commands/workspaceResolver";

describe("selectWorkspacePath", () => {
  it("prefers the workspace containing the active editor", () => {
    const selected = selectWorkspacePath({
      workspaceFolders: ["/repo/api", "/repo/web"],
      activeDocumentPath: "/repo/web/src/index.ts"
    });

    expect(selected).toBe("/repo/web");
  });

  it("falls back to the first workspace when the active editor is outside the workspace", () => {
    const selected = selectWorkspacePath({
      workspaceFolders: ["/repo/api", "/repo/web"],
      activeDocumentPath: "/tmp/notes.md"
    });

    expect(selected).toBe("/repo/api");
  });
});
