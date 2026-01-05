import * as os from 'node:os';
import path from 'node:path';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import { buildExcludeGlob } from './utils';

const CONCURRENCY = 16;
const MIN_QUERY_LENGTH = 2;

function getConfig() {
  const config = vscode.workspace.getConfiguration('dfiles');
  return {
    maxFiles: config.get<number>('search.maxFiles', 5000),
    maxFileSize: config.get<number>('search.maxFileSize', 512 * 1024),
    maxMatchesPerFile: config.get<number>('search.maxMatchesPerFile', 10),
    maxResults: config.get<number>('search.maxResults', 100),
    debounceTime: config.get<number>('search.debounceTime', 150),
  };
}

interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
}

export class SearchProject {
  private quickPick: vscode.QuickPick<vscode.QuickPickItem> | null = null;
  private cachedFiles: string[] = [];
  private root = '';
  private searchId = 0;
  private debounceTimer: NodeJS.Timeout | null = null;
  private results: SearchResult[] = [];

  async show(): Promise<void> {
    this.root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
    this.searchId = 0;
    this.results = [];

    this.quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
    this.quickPick.placeholder = 'Type to search file contents (min 2 chars)';
    this.quickPick.title = `Search: ${this.root}`;
    this.quickPick.busy = true;
    this.quickPick.show();

    // cache file list an open
    await this.cacheFileList();
    this.quickPick.busy = false;

    this.quickPick.onDidChangeValue(this.onValueChange.bind(this));
    this.quickPick.onDidAccept(this.onAccept.bind(this));
    this.quickPick.onDidHide(() => this.dispose());
  }

  private async cacheFileList(): Promise<void> {
    try {
      const { maxFiles } = getConfig();
      const excludePattern = await buildExcludeGlob(this.root);
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.root, '**/*'),
        excludePattern,
        maxFiles
      );
      this.cachedFiles = files.map((uri) => uri.fsPath);
    } catch {
      this.cachedFiles = [];
    }
  }

  // perform the search - called after debounce timeout
  private async performSearch(query: string): Promise<void> {
    if (!this.quickPick) return;

    const { maxResults } = getConfig();

    // increment search id to cancel old searches
    const currentSearchId = ++this.searchId;
    this.quickPick.busy = true;
    this.results = [];

    const queryLower = query.toLowerCase();

    // process files with concurrency limit
    for (let i = 0; i < this.cachedFiles.length; i += CONCURRENCY) {
      // check if search was cancelled
      if (this.searchId !== currentSearchId) break;
      if (this.results.length >= maxResults) break;

      const chunk = this.cachedFiles.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map((file) => this.searchFile(file, queryLower, currentSearchId))
      );

      for (const fileResults of chunkResults) {
        if (this.searchId !== currentSearchId) return;

        for (const result of fileResults) {
          this.results.push(result);
          if (this.results.length >= maxResults) break;
        }
        if (this.results.length >= maxResults) break;
      }
    }

    // check if this search is still current
    if (this.searchId !== currentSearchId) return;

    this.quickPick.items = this.results.map((r) => ({
      label: `$(file) ${path.basename(r.file)}:${r.line}`,
      description: path.relative(this.root, path.dirname(r.file)),
      detail: r.content.length > 120 ? `${r.content.substring(0, 120)}...` : r.content,
      alwaysShow: true,
    }));

    this.quickPick.busy = false;
  }

  // search a single file for matches
  private async searchFile(
    filePath: string,
    query: string,
    searchId: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const { maxFileSize, maxMatchesPerFile } = getConfig();

    try {
      // check if cancelled
      if (this.searchId !== searchId) return results;

      // check file size
      const stat = await fs.promises.stat(filePath);
      if (stat.size > maxFileSize) return results;
      if (!stat.isFile()) return results;

      const content = await fs.promises.readFile(filePath, 'utf-8');

      // skip binary files (simple heuristic)
      if (content.includes('\0')) return results;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length && results.length < maxMatchesPerFile; i++) {
        const line = lines[i];
        const lineLower = line.toLowerCase();
        const column = lineLower.indexOf(query.toLowerCase());

        if (column !== -1) {
          results.push({
            file: filePath,
            line: i + 1,
            column: column + 1,
            content: line.trim(),
          });
        }
      }
    } catch (err) {
      // skip files that can't be read
    }

    return results;
  }

  // handle value change in the quick pick
  private onValueChange(value: string): void {
    // clear previous debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      if (this.quickPick) {
        this.quickPick.items = [];
        this.results = [];
      }
      return;
    }

    const { debounceTime } = getConfig();
    this.debounceTimer = setTimeout(() => this.performSearch(query), debounceTime);
  }

  // handle selection of a result
  private async onAccept(): Promise<void> {
    const selected = this.quickPick?.activeItems[0];
    if (!selected) return;

    // find the corresponding result
    const index = this.quickPick?.items.indexOf(selected) ?? -1;
    if (index === -1 || !this.results[index]) return;

    const result = this.results[index];
    this.quickPick?.hide();

    // open file and set focus on it
    const doc = await vscode.workspace.openTextDocument(result.file);
    const editor = await vscode.window.showTextDocument(doc);

    // position cursor and center view at match location
    const position = new vscode.Position(result.line - 1, result.column - 1);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  // cleanup resources
  private dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.quickPick?.dispose();
    this.quickPick = null;
    this.cachedFiles = [];
    this.results = [];
  }
}
