import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/out/**',
  '**/.next/**',
  '**/build/**',
  '**/*.min.js',
  '**/*.map',
  '**/*.lock',
];

export async function buildExcludeGlob(root: string): Promise<string> {
  const excludes = [...DEFAULT_EXCLUDES];

  try {
    const gitIgnorePath = path.join(root, '.gitignore');
    const gitIgnoreContent = await fs.promises.readFile(gitIgnorePath, 'utf-8');

    for (const line of gitIgnoreContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // convert gitignore pattern to glob pattern
      let pattern = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

      // handle negation - skip for now
      if (pattern.startsWith('!')) continue;

      // if no wildcard, wrap with **
      if (!pattern.includes('*')) {
        pattern = `**/${pattern}/**`;
      }

      excludes.push(pattern);
    }
  } catch {
    // no .gitignore, use defaults
  }

  return `{${excludes.join(',')}}`;
}
