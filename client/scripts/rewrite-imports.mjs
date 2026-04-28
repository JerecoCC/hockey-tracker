/**
 * Enforces depth-based import style:
 *  - Same directory (./)      → keep as ./
 *  - 1 level up (../)         → keep as ../  (or revert @/ back to ../)
 *  - 2+ levels up (../../+)   → use @/ alias (or revert ../ back to @/)
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

/** Count leading ../ segments in a relative import path. */
function dotDotDepth(relPath) {
  let count = 0;
  let s = relPath;
  while (s.startsWith('../')) { count++; s = s.slice(3); }
  return count;
}

/** Resolve an @/ alias to a relative path from filePath's directory. */
function aliasToRelative(filePath, aliasPath) {
  const fileDir = path.dirname(filePath);
  const target = path.join(srcDir, aliasPath);
  const rel = path.relative(fileDir, target).replace(/\\/g, '/');
  // path.relative returns bare names when same-dir; prefix ./
  return rel.startsWith('.') ? rel : './' + rel;
}

// Matches: from '@/...'  OR  from '../...'  OR  from './'
const IMPORT_RE = /\bfrom\s+(['"])((?:@\/|\.\.?\/)[^'"]+)\1/g;

let totalFiles = 0;
let changedFiles = 0;

for (const filePath of getFiles(srcDir)) {
  const original = fs.readFileSync(filePath, 'utf8');

  const updated = original.replace(IMPORT_RE, (match, quote, importPath) => {
    const fileDir = path.dirname(filePath);

    if (importPath.startsWith('@/')) {
      // --- existing alias: revert to relative if depth < 2 ---
      const aliasPath = importPath.slice(2); // strip '@/'
      const rel = aliasToRelative(filePath, aliasPath);
      const depth = dotDotDepth(rel);
      if (depth < 2) return `from ${quote}${rel}${quote}`;
      return match; // keep @/

    } else {
      // --- relative import: convert to @/ if depth >= 2 ---
      if (importPath.startsWith('./')) return match; // same-dir, leave alone
      const depth = dotDotDepth(importPath);
      if (depth < 2) return match; // 1 level up, leave alone
      const resolved = path.resolve(fileDir, importPath);
      const fromSrc = path.relative(srcDir, resolved).replace(/\\/g, '/');
      if (fromSrc.startsWith('..')) return match; // outside src
      return `from ${quote}@/${fromSrc}${quote}`;
    }
  });

  totalFiles++;
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('  updated:', path.relative(srcDir, filePath));
    changedFiles++;
  }
}

console.log(`\nDone. ${changedFiles}/${totalFiles} files updated.`);
