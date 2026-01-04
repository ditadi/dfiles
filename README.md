# dFiles

Emacs/Doom-style file navigation for VS Code and Cursor.

dFiles brings keyboard-driven file management to VS Code with Spacemacs-style keybindings. If you've used Emacs dired, Doom Emacs, or Neovim file navigation, you'll feel at home.

## Features

### Find File (`SPC f d`)

Navigate directories with your keyboard.

- **Start point**: Opens at the active file's directory
- **Navigate up**: Backspace on empty input, or type `-`
- **Enter directory**: Select and press Enter
- **Open file**: Select and press Enter
- **Auto-traverse**: Type `folder1/folder2/` to navigate multiple levels
- **Create file**: Type `newfile.ts` + Enter (when no match exists)
- **Create folder**: Type `newfolder/` + Enter
- **Create nested**: Type `path/to/file.ts` + Enter
- **Delete**: `Ctrl+D` (with confirmation)
- **Rename**: `Ctrl+R`
- **Copy path**: `Ctrl+Y`

Hidden files (`.` prefix) only appear when your filter starts with `.`

### Find Recent (`SPC f r`)

Quick access to recently opened files and visited folders.

- Persists across sessions
- Shows both files and folders
- Most recent items first
- Maximum 50 entries

### Find Project Files (`SPC f p`)

Search files by name across your project.

- Searches from active file's directory
- Respects `.gitignore`
- Case-insensitive matching
- Excludes `node_modules`, `.git`, `dist`, `build`, etc.

### Search in Project (`SPC s p`)

Full-text search across project files.

- **Reactive**: Results update as you type (no Enter required)
- **Debounced**: 150ms delay for smooth typing
- **Smart limits**: Skips files > 512KB, max 100 results
- **Precise navigation**: Opens file at exact line and column

## Keybindings

| Command | Keybinding | Description |
|---------|------------|-------------|
| Find File | `SPC f d` | Directory navigation |
| Find Recent | `SPC f r` | Recent files/folders |
| Find Project Files | `SPC f p` | Search by filename |
| Search in Project | `SPC s p` | Search file contents |

**In QuickPick:**

| Action | Keybinding |
|--------|------------|
| Delete | `Ctrl+D` |
| Rename | `Ctrl+R` |
| Copy path | `Ctrl+Y` |

Keybindings work in Vim normal mode and won't interfere with insert mode.

## Installation

### From VS Code Marketplace

Search for "dFiles" in the Extensions view (`Ctrl+Shift+X`).

### From VSIX

```bash
code --install-extension dfiles-x.x.x.vsix
```

## Requirements

- VS Code 1.85.0 or later
- Works with Cursor

For Spacemacs-style keybindings, a Vim extension is recommended but not required.

## Performance

dFiles is designed to stay fast:

- **File search**: Limited to 5,000 files
- **Content search**: 512KB file size cap, max 5 matches per file, 100 total results
- **Directory listing**: Cached and filtered in-memory
- **Debounced input**: 150ms delay on content search

## Privacy

dFiles collects no telemetry. Your file paths and search queries stay on your machine.

## Known Limitations

1. QuickPick appears at top of window (VS Code limitation)
2. Substring matching only (no fuzzy scoring like fzf)
3. Only reads root `.gitignore`, not nested ones

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)

---

**dFiles** is part of the [ditadi](https://ditadi.dev) project family.
