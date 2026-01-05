import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

const STORAGE_KEY = 'dfiles.recentEntries';

function getConfig() {
  const config = vscode.workspace.getConfiguration('dfiles');
  return {
    maxEntries: config.get<number>('recent.maxEntries', 50),
  };
}

interface RecentEntry {
  path: string;
  isDirectory: boolean;
  timestamp: number;
}

/**
 * Recent Files - Quick access to recently opened files and folders
 * - Manage a internal cache of recent files and folders in global state
 */
export class RecentFiles {
  private context: vscode.ExtensionContext;
  private quickPick: vscode.QuickPick<vscode.QuickPickItem> | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // show the quick pick
  async show(): Promise<void> {
    this.quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
    this.quickPick.placeholder = 'Select recent file or folder';
    this.quickPick.title = 'Recent Files';

    const entries = this.getEntries();

    this.quickPick.items = entries.map((entry) => ({
      label: `${entry.isDirectory ? '$(folder)' : '$(file)'} ${path.basename(entry.path)}`,
      description: path.dirname(entry.path),
      detail: entry.path,
    }));

    this.quickPick.onDidAccept(() => this.onAccept());
    this.quickPick.onDidHide(() => {
      this.quickPick?.dispose();
      this.quickPick = null;
    });

    this.quickPick.show();
  }

  // handle selection of an item
  private async onAccept(): Promise<void> {
    const selected = this.quickPick?.activeItems[0];
    if (!selected?.detail) return;

    const fullPath = selected.detail;

    try {
      const stat = await fs.promises.stat(fullPath);
      this.quickPick?.hide();

      if (stat.isDirectory()) {
        // open find-file at this directory - dispatch command
        vscode.commands.executeCommand('dfiles.findFile.showAtPath', fullPath);
      } else {
        // open file and set focus on it
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc);
      }
    } catch {
      vscode.window.showErrorMessage(`Path no longer exists: ${fullPath}`);
      this.removeEntry(fullPath);
    }
  }

  // add a new entry to the history
  addEntry(filePath: string, isDirectory: boolean): void {
    const entries = this.getEntries();
    const { maxEntries } = getConfig();

    // remove existing entry if it exists (will re-add at top)
    const filtered = entries.filter((entry) => entry.path !== filePath);

    // add at the top
    filtered.unshift({
      path: filePath,
      isDirectory,
      timestamp: Date.now(),
    });

    // enforce max entries
    const trimmed = filtered.slice(0, maxEntries);
    this.context.globalState.update(STORAGE_KEY, trimmed);
  }

  // clear the history
  clearHistory(): void {
    this.context.globalState.update(STORAGE_KEY, []);
    vscode.window.showInformationMessage('Recent history cleared');
  }

  // get the entries from the global state
  private getEntries(): RecentEntry[] {
    return this.context.globalState.get<RecentEntry[]>(STORAGE_KEY, []);
  }

  // remove an entry from the history
  private removeEntry(filePath: string): void {
    const entries = this.getEntries();
    const filtered = entries.filter((entry) => entry.path !== filePath);
    this.context.globalState.update(STORAGE_KEY, filtered);
  }
}
