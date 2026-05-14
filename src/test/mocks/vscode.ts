import { vi } from "vitest";

export const ProgressLocation = { Notification: 15, Window: 10, SourceControl: 1 };
export const ViewColumn = { One: 1, Two: 2, Three: 3 };

export const Uri = {
  file: vi.fn((p: string) => ({ fsPath: p, scheme: "file", toString: () => p }))
};

const createWebviewPanel = () => ({
  webview: {
    html: "",
    cspSource: "vscode-resource:",
    onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
    postMessage: vi.fn().mockResolvedValue(true)
  },
  title: "",
  onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
  reveal: vi.fn()
});

export const window = {
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  withProgress: vi.fn((_, task: (progress: unknown) => unknown) => task({ report: vi.fn() })),
  createWebviewPanel: vi.fn(createWebviewPanel),
  showTextDocument: vi.fn().mockResolvedValue(undefined),
  activeTextEditor: undefined
};

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: "/test/workspace" }, name: "workspace", index: 0 }],
  getConfiguration: vi.fn(() => ({ get: vi.fn() })),
  openTextDocument: vi.fn().mockResolvedValue({ uri: { fsPath: "/test/file.ts" } })
};

export const commands = {
  registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  executeCommand: vi.fn()
};

export const StatusBarAlignment = { Left: 1, Right: 2 };

/** Reset all mocks between tests — call in beforeEach. */
export function resetVscodeMocks(): void {
  vi.clearAllMocks();
  window.createWebviewPanel.mockImplementation(createWebviewPanel);
  window.showWarningMessage.mockResolvedValue(undefined);
  window.showErrorMessage.mockResolvedValue(undefined);
  window.showInformationMessage.mockResolvedValue(undefined);
  window.withProgress.mockImplementation((_, task: (progress: unknown) => unknown) =>
    task({ report: vi.fn() })
  );
}
