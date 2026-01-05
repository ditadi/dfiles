import * as vscode from 'vscode';
import { FindFile } from './find-file';

export function activate(context: vscode.ExtensionContext): void {
  const findFile = new FindFile();

  context.subscriptions.push(
    vscode.commands.registerCommand('dfiles.findFile', () => findFile.show()),
    vscode.commands.registerCommand('dfiles.findFile.delete', () => findFile.deleteSelected()),
    vscode.commands.registerCommand('dfiles.findFile.rename', () => findFile.renameSelected()),
    vscode.commands.registerCommand('dfiles.findFile.copyPath', () => findFile.copyPath()),
    vscode.commands.registerCommand('dfiles.recentFiles', () => {
      vscode.window.showInformationMessage('recent files not implemented yet');
    }),
    vscode.commands.registerCommand('dfiles.projectFiles', () => {
      vscode.window.showInformationMessage('project files not implemented yet');
    }),
    vscode.commands.registerCommand('dfiles.searchProject', () => {
      vscode.window.showInformationMessage('search project not implemented yet');
    })
  );
}

export function deactivate(): void {}
