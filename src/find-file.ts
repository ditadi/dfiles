import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getStartDirectory } from './utils';

interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
}

interface FindFileCallbacks {
  onDirectoryVisited?: (dir: string) => void;
  onFileOpened?: (file: string) => void;
}

/**
 * Find File - Directory navigation and file management
 * - Navigate directories with your keyboard
 * - Create files and folders
 * - Delete files and folders
 * - Rename files and folders
 * - Copy file paths
 */
export class FindFile {
  private quickPick: vscode.QuickPick<vscode.QuickPickItem> | null = null;
  private disposables: vscode.Disposable[] = [];
  private currentDir = '';
  private previousValue = '';
  private cachedEntries: DirectoryEntry[] = [];
  private callbacks: FindFileCallbacks = {};

  constructor(callbacks: FindFileCallbacks = {}) {
    this.callbacks = callbacks;
  }

  // show the quick pick
  async show(): Promise<void> {
    this.currentDir = getStartDirectory();
    this.createQuickPick();

    if (!this.quickPick) return;

    this.quickPick.title = this.currentDir;
    this.quickPick.busy = true;
    this.quickPick.show();
    await this.refreshDirectory();
  }

  // show the quick pick at a specific path (used for recent files)
  async showAtPath(dir: string): Promise<void> {
    this.currentDir = dir;
    this.createQuickPick();
    if (!this.quickPick) return;

    this.quickPick.title = this.currentDir;
    this.quickPick.busy = true;
    this.quickPick.show();
    await this.refreshDirectory();
  }

  // delete selected item (file or directory)
  async deleteSelected(): Promise<void> {
    const selected = this.quickPick?.activeItems[0];
    if (!selected) return;

    const name = this.extractName(selected.label);
    const fullPath = path.join(this.currentDir, name);

    // create confirmation dialog
    const confirm = await vscode.window.showWarningMessage(
      `Delete "${name}"?`,
      { modal: true },
      'Delete'
    );

    if (confirm === 'Delete') {
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) {
          // if it's a directory, delete it recursively
          await fs.promises.rm(fullPath, { recursive: true });
        } else {
          // if it's a file, delete it
          await fs.promises.unlink(fullPath);
        }
        await this.refreshDirectory();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to delete: ${err}`);
      }
    }
  }

  // rename selected file or directory
  async renameSelected(): Promise<void> {
    const selected = this.quickPick?.activeItems[0];
    if (!selected) return;

    const oldName = this.extractName(selected.label);
    // show input box to type the file new name
    const newName = await vscode.window.showInputBox({
      prompt: 'New name',
      value: oldName,
      valueSelection: [0, oldName.lastIndexOf('.') > 0 ? oldName.lastIndexOf('.') : oldName.length],
    });

    if (newName && newName !== oldName) {
      try {
        const oldPath = path.join(this.currentDir, oldName);
        const newPath = path.join(this.currentDir, newName);
        await fs.promises.rename(oldPath, newPath);
        await this.refreshDirectory();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to rename: ${err}`);
      }
    }
  }

  // copy path of selected item
  async copyPath(): Promise<void> {
    const selected = this.quickPick?.activeItems[0];
    if (!selected) return;

    const name = this.extractName(selected.label);
    const fullPath = path.join(this.currentDir, name);

    // clipboard copy the full path
    await vscode.env.clipboard.writeText(fullPath);
    vscode.window.showInformationMessage(`Copied: ${fullPath}`);
  }

  private createQuickPick(): void {
    this.dispose();

    this.quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
    this.quickPick.placeholder = 'Filter | "-" up | "name/" create folder | "a/b.ts" nested';
    this.quickPick.value = ' ';
    this.previousValue = ' ';

    this.quickPick.buttons = [
      {
        iconPath: new vscode.ThemeIcon('arrow-up'),
        tooltip: 'Go to parent directory (or press "-")',
      },
      { iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Delete item (Ctrl+D)' },
      { iconPath: new vscode.ThemeIcon('edit'), tooltip: 'Rename item (Ctrl+R)' },
      { iconPath: new vscode.ThemeIcon('clippy'), tooltip: 'Copy full path (Ctrl+Y)' },
    ];

    this.disposables.push(
      this.quickPick.onDidChangeValue(this.onValueChange.bind(this)),
      this.quickPick.onDidAccept(this.onAccept.bind(this)),
      this.quickPick.onDidTriggerButton(this.onTriggerButton.bind(this)),
      this.quickPick.onDidHide(() => this.dispose())
    );
  }

  // handle value changes on input field
  private async onValueChange(value: string): Promise<void> {
    // detect backspace
    if (value === '' && this.previousValue === ' ') {
      await this.goUpDirectory();
      return;
    }

    // detect "-" for go up
    if (value === '-' || value === ' -') {
      await this.goUpDirectory();
      return;
    }

    // auto-traverse path when `/` is typed
    if (value.includes('/')) {
      const handled = await this.handlePathTraversal(value);
      if (handled) return;
    }

    this.previousValue = value;
    this.filterCachedEntries(value);
  }

  // handle auto-traversal with validations
  private async handlePathTraversal(value: string): Promise<boolean> {
    const trimmed = value.trim();
    const segments = trimmed.split('/');

    // only handle if there's content before the slash
    if (segments.length < 2 || !segments[0]) return false;

    // check if first segment matches a directory
    const firstSegment = segments[0];
    const match = this.cachedEntries.find(
      (e) => e.isDirectory && e.name.toLowerCase() === firstSegment.toLowerCase()
    );
    if (match) {
      this.currentDir = path.join(this.currentDir, firstSegment);
      await this.refreshDirectory();

      // set remaining path as new value
      const remaining = segments.slice(1).join('/');
      if (this.quickPick) {
        this.quickPick.value = remaining ? ` ${remaining}` : ' ';
        this.previousValue = this.quickPick.value;
      }
      return true;
    }
    return false;
  }

  private async onAccept(): Promise<void> {
    const selected = this.quickPick?.selectedItems[0];
    const inputValue = this.quickPick?.value.trim() || '';

    // if there's a selected item, use it
    if (selected) {
      const name = this.extractName(selected.label);
      const fullPath = path.join(this.currentDir, name);

      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) {
          this.currentDir = fullPath;
          this.callbacks.onDirectoryVisited?.(this.currentDir);
          await this.refreshDirectory();
        } else {
          await this.openFile(fullPath);
        }
        return;
      } catch (err) {
        // fall through to creation logic
      }
    }

    // if there's input value, handle create
    if (inputValue) {
      await this.handleCreate(inputValue);
    }
  }

  private async handleCreate(inputValue: string): Promise<void> {
    const fullPath = path.join(this.currentDir, inputValue);

    // check if item already exists
    try {
      await fs.promises.access(fullPath);
      // exists, open it
      const stat = await fs.promises.stat(fullPath);
      // if it's a directory, navigate into it
      if (stat.isDirectory()) {
        this.currentDir = fullPath;
        await this.refreshDirectory();
        return;
      }

      // if it's a file, open it
      await this.openFile(fullPath);
      return;
    } catch {
      // doesn't exist, create it
    }

    if (inputValue.endsWith('/')) {
      // if ends with /, create a folder
      const dirPath = fullPath.slice(0, -1);
      await fs.promises.mkdir(dirPath, { recursive: true });
      this.currentDir = dirPath;
      this.callbacks.onDirectoryVisited?.(this.currentDir);
      // navigate to created folder
      await this.refreshDirectory();
    } else if (inputValue.includes('/')) {
      // created nested path with file
      const dirPath = path.dirname(fullPath);
      await fs.promises.mkdir(dirPath, { recursive: true });
      await this.createAndOpenFile(fullPath);
    } else {
      // simple file creation
      await this.createAndOpenFile(fullPath);
    }
  }

  // create empty file and open it
  private async createAndOpenFile(fullPath: string): Promise<void> {
    await fs.promises.writeFile(fullPath, '');
    await this.openFile(fullPath);
  }

  // open file and set focus on it
  private async openFile(fullPath: string): Promise<void> {
    this.quickPick?.hide();
    const doc = await vscode.workspace.openTextDocument(fullPath);
    await vscode.window.showTextDocument(doc);
    this.callbacks.onFileOpened?.(fullPath);
  }

  // handles keyboard shortcuts (delete, rename, copy path)
  private async onTriggerButton(button: vscode.QuickInputButton): Promise<void> {
    switch (button.tooltip) {
      case 'Go to parent directory (or press "-")':
        await this.goUpDirectory();
        break;
      case 'Delete item (Ctrl+D)':
        await this.deleteSelected();
        break;
      case 'Rename item (Ctrl+R)':
        await this.renameSelected();
        break;
      case 'Copy full path (Ctrl+Y)':
        await this.copyPath();
        break;
    }
  }

  private async goUpDirectory(): Promise<void> {
    const parent = path.dirname(this.currentDir);
    if (parent !== this.currentDir) {
      this.currentDir = parent;
      this.callbacks.onDirectoryVisited?.(this.currentDir);
      await this.refreshDirectory();
    }
  }

  private async refreshDirectory(): Promise<void> {
    if (!this.quickPick) return;

    this.quickPick.title = this.currentDir;
    this.quickPick.value = ' ';
    this.previousValue = ' ';
    this.quickPick.busy = true;

    try {
      // read the directory and cache the entries
      this.cachedEntries = await this.readDirectory();
      this.renderItems(this.cachedEntries);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to read directory: ${this.currentDir}`);
      this.cachedEntries = [];
      this.renderItems([]);
    }

    this.quickPick.busy = false;
  }

  private async readDirectory(): Promise<DirectoryEntry[]> {
    const entries = await fs.promises.readdir(this.currentDir, { withFileTypes: true });

    // sort the entries: directories first, then alphabetically
    return entries
      .map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  // filter cached entries based on the input value
  private filterCachedEntries(value: string): void {
    const filter = value.trim().toLowerCase();
    const showHidden = filter.startsWith('.');

    const filtered = this.cachedEntries.filter((entry) => {
      // hidden file logic
      if (entry.name.startsWith('.') && !showHidden) return false;

      if (!filter) return !entry.name.startsWith('.');
      return entry.name.toLowerCase().includes(filter);
    });

    this.renderItems(filtered);
  }

  // render the items in the quick pick
  private renderItems(entries: DirectoryEntry[]): void {
    if (!this.quickPick) return;

    this.quickPick.items = entries.map((entry) => ({
      label: entry.isDirectory ? `$(folder) ${entry.name}` : `$(file) ${entry.name}`,
    }));
  }

  private extractName(label: string): string {
    // remove icon prefix like $(folder) or $(file)
    return label.replace(/^\$\([^)]+\)\s*/, '');
  }

  // dispose of the quick pick and clear the disposables
  private dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.quickPick?.dispose();
    this.quickPick = null;
  }
}
