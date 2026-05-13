import path from "node:path";

export interface WorkspaceSelectionInput {
  workspaceFolders: string[];
  activeDocumentPath?: string;
}

export function selectWorkspacePath(input: WorkspaceSelectionInput): string | undefined {
  if (input.workspaceFolders.length === 0) {
    return undefined;
  }

  if (!input.activeDocumentPath) {
    return input.workspaceFolders[0];
  }

  const activePath = path.resolve(input.activeDocumentPath);
  const containingFolder = input.workspaceFolders
    .map((folder) => path.resolve(folder))
    .filter((folder) => activePath === folder || activePath.startsWith(`${folder}${path.sep}`))
    .sort((a, b) => b.length - a.length)[0];

  return containingFolder ?? input.workspaceFolders[0];
}
