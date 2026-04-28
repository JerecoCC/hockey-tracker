/**
 * Rewrites relative cross-directory imports to @/ aliases.
 * Rules:
 *  - '../...' imports are always converted to @/
 *  - './subdir/...' imports where the resolved path leaves the current file's dir are converted
 *  - Same-directory './foo' or './foo.module.scss' imports are left unchanged
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

function getFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFiles(full));
    } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Given a file path and an import string, returns the @/ alias if the import
 * crosses a directory boundary, or null if it should be left unchanged.
 */
function toAlias(filePath, importPath) {
  // Resolve the import to an absolute path (without extension — keep as-is)
  const fileDir = path.dirname(filePath);
  const resolved = path.resolve(fileDir, importPath);

  // Must be inside srcDir
  const rel = path.relative(srcDir, resolved);
  if (rel.startsWith('..')) return null; // outside src — skip

  // Same-directory: dirname of resolved === fileDir
  if (path.dirname(resolved) === fileDir && !importPath.includes('/')) return null;

  return '@/' + rel.replace(/\\/g, '/');
}

// Regex matches: from '...' or from "..."
// Captures the quote char and the path
const IMPORT_RE = /\bfrom\s+(['"])(\.\.?\/[^'"]+)\1/g;

let totalFiles = 0;
let changedFiles = 0;

for (const filePath of getFiles(srcDir)) {
  const original = fs.readFileSync(filePath, 'utf8');

  const updated = original.replace(IMPORT_RE, (match, quote, importPath) => {
    // Skip same-dir ./ imports that stay in the same folder
    const alias = toAlias(filePath, importPath);
    if (!alias) return match;
    return `from ${quote}${alias}${quote}`;
  });

  totalFiles++;
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('  updated:', path.relative(srcDir, filePath));
    changedFiles++;
  }
}

console.log(`\nDone. ${changedFiles}/${totalFiles} files updated.`);
