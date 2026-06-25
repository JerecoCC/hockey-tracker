import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localHome = resolve(rootDir, 'node_modules', '.cache', 'storybook-home');
const appData = resolve(localHome, 'AppData', 'Roaming');

mkdirSync(appData, { recursive: true });

process.env.HOME = localHome;
process.env.USERPROFILE = localHome;
process.env.APPDATA = appData;
process.env.STORYBOOK_DISABLE_TELEMETRY ??= '1';
process.env.CI ??= '1';

const args = process.argv.slice(2);
const storybookBin = resolve(rootDir, 'node_modules', 'storybook', 'bin', 'index.cjs');
const result = spawnSync(process.execPath, [storybookBin, ...args], {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
