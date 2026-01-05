import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

export function getStartDirectory(): string {
  // active file's directory
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.uri.scheme === 'file') {
    return path.dirname(activeEditor.document.uri.fsPath);
  }

  // workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return workspaceFolder.uri.fsPath;
  }

  // home directory
  const homeDir = os.homedir();
  if (homeDir) {
    return homeDir;
  }

  // root directory
  return '/';
}
