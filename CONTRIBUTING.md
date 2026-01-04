# Contributing to dFiles

Thanks for your interest in contributing to dFiles.

## Development Setup

### Prerequisites

- Node.js 20.x or later
- VS Code or Cursor

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ditadi/dfiles.git
cd dfiles

# Install dependencies
npm ci

# Compile TypeScript
npm run compile

# Or watch for changes
npm run watch
```

### Running the Extension

1. Open the project in VS Code/Cursor
2. Press `F5` to launch the Extension Development Host
3. Test the commands:
   - `SPC f d` - Find File
   - `SPC f r` - Find Recent
   - `SPC f p` - Find Project Files
   - `SPC s p` - Search in Project

## Code Guidelines

### TypeScript

- Strict mode enabled
- No `any` types without justification
- Prefer `const` over `let`

### Performance

This extension must stay responsive. Key rules:

- **No blocking loops**: Use async/await with concurrency limits
- **Cancel stale work**: New searches must cancel in-progress ones
- **Cache when possible**: Directory listings, file lists
- **Respect limits**: 5,000 files max, 512KB file size cap

### Testing Changes

Before submitting:

1. Run the linter: `npm run lint`
2. Compile successfully: `npm run compile`
3. Manual testing in Extension Development Host:
   - Test all four commands
   - Test edge cases (empty directories, large files, hidden files)
   - Verify keybindings work with Vim extension

## Submitting Changes

### Issues

- **Bug reports**: Include VS Code version, steps to reproduce, expected vs actual behavior
- **Feature requests**: Describe the use case, not just the solution

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run lint and compile
5. Commit with a clear message
6. Push and open a PR

PR checklist:

- [ ] Code compiles without errors
- [ ] Linter passes
- [ ] Tested manually in Extension Development Host
- [ ] Updated CHANGELOG.md if user-facing

## Architecture Notes

### QuickPick Space Marker

VS Code doesn't fire `onDidChangeValue` when backspacing on empty input. We use a space character as an "empty" marker to detect backspace and navigate up.

### Start Directory Resolution

All commands that need a starting directory use this fallback chain:

1. Active file's directory
2. Workspace folder
3. HOME directory
4. Root (`/`)

### Exclude Pattern Building

File search commands build exclude patterns from:

1. Default excludes (`node_modules`, `.git`, etc.)
2. Root `.gitignore` patterns (converted to glob format)

## Questions?

Open an issue for questions about contributing.
