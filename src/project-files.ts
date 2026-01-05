import * as path from 'node:path';
import * as vscode from 'vscode';
import { buildExcludeGlob, getStartDirectory } from './utils';

const MAX_FILES = 5000;

/**
 * Project Files - Search for files by name across the project
 * - Searches from active file's directory
 * - Respects .gitignore patterns
 * - Case-insensitive matching
 * - Limits to 5000 files for performance
 * - Sorted alphabetically by name
 * - Opens file and sets focus on it when selected
 */
export class ProjectFiles {
  private quickPick: vscode.QuickPick<vscode.QuickPickItem> | null = null;
  private root = '';

  async show(): Promise<void> {
    this.root = getStartDirectory();
    this.quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();

    this.quickPick.placeholder = 'Type to search files by name';
    this.quickPick.title = `Project Files: ${this.root}`;
    this.quickPick.busy = true;
    this.quickPick.matchOnDescription = true;
    this.quickPick.show();

    try {
      // build exclude pattern (based on .gitignore)
      const excludePattern = await buildExcludeGlob(this.root);
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.root, '**/*'),
        excludePattern,
        MAX_FILES
      );

      // sort files alphabetically by name
      this.quickPick.items = files
        .map((uri) => ({
          label: `$(file) ${path.basename(uri.fsPath)}`,
          description: uri.fsPath,
          detail: uri.fsPath,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      this.quickPick.busy = false;
    } catch (err) {
      this.quickPick.busy = false;
      vscode.window.showErrorMessage(`Failed to read project files: ${err}`);
    }

    this.quickPick.onDidAccept(this.onAccept.bind(this));
    this.quickPick.onDidHide(() => {
      this.quickPick?.dispose();
      this.quickPick = null;
    });
  }

  private async onAccept(): Promise<void> {
    const selected = this.quickPick?.activeItems[0];
    if (!selected?.detail) return;

    this.quickPick?.hide();
    // open file and set focus on it
    const doc = await vscode.workspace.openTextDocument(selected.detail);
    await vscode.window.showTextDocument(doc);
  }
}
