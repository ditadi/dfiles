import * as vscode from 'vscode';
import { FindFile } from './find-file';
import { RecentFiles } from './recent-files';
import { ProjectFiles } from './project-files';

export function activate(context: vscode.ExtensionContext): void {
  const recentFiles = new RecentFiles(context);
  const findFile = new FindFile({
    onDirectoryVisited: (dir: string) => recentFiles.addEntry(dir, true),
    onFileOpened: (file: string) => recentFiles.addEntry(file, false),
  });
  const projectFiles = new ProjectFiles();

  context.subscriptions.push(
    vscode.commands.registerCommand('dfiles.findFile', () => findFile.show()),
    vscode.commands.registerCommand('dfiles.findFile.showAtPath', (path: string) =>
      findFile.showAtPath(path)
    ),
    vscode.commands.registerCommand('dfiles.findFile.delete', () => findFile.deleteSelected()),
    vscode.commands.registerCommand('dfiles.findFile.rename', () => findFile.renameSelected()),
    vscode.commands.registerCommand('dfiles.findFile.copyPath', () => findFile.copyPath()),

    vscode.commands.registerCommand('dfiles.recentFiles', () => recentFiles.show()),

    vscode.commands.registerCommand('dfiles.recentFiles.clear', () => recentFiles.clearHistory()),
    vscode.commands.registerCommand('dfiles.projectFiles', () => projectFiles.show()),
    vscode.commands.registerCommand('dfiles.searchProject', () => {
      vscode.window.showInformationMessage('search project not implemented yet');
    })
  );
}

export function deactivate(): void {}
