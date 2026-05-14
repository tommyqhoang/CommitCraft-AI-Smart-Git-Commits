import { describe, expect, it } from "vitest";

import { selectWorkspacePath } from "../commands/workspaceResolver";

describe("selectWorkspacePath", () => {
  it("returns undefined when no workspace folders are open", () => {
    const selected = selectWorkspacePath({
      workspaceFolders: [],
      activeDocumentPath: "/repo/web/src/index.ts"
    });

    expect(selected).toBeUndefined();
  });

  it("uses the first workspace when there is no active editor", () => {
    const selected = selectWorkspacePath({
      workspaceFolders: ["/repo/api", "/repo/web"]
    });

    expect(selected).toBe("/repo/api");
  });

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

  it("prefers the deepest containing workspace for nested folders", () => {
    const selected = selectWorkspacePath({
      workspaceFolders: ["/repo", "/repo/packages/web"],
      activeDocumentPath: "/repo/packages/web/src/index.ts"
    });

    expect(selected).toBe("/repo/packages/web");
  });
});
