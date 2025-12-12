#!/usr/bin/env node
/**
 * Icon Injection Script
 *
 * Adds the application icon to the Windows executable using rcedit.
 * Run after building the Windows executable.
 */

import rcedit from 'rcedit';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const exePath = join(rootDir, 'dist', 'deceive-node-win.exe');
const iconPath = join(rootDir, 'assets', 'logo.ico');

console.log('Adding icon to Windows executable...');

if (!existsSync(exePath)) {
  console.log(`Executable not found: ${exePath}`);
  console.log('Skipping icon injection (this is normal for non-Windows builds).');
  process.exit(0);
}

if (!existsSync(iconPath)) {
  console.error(`Icon not found: ${iconPath}`);
  process.exit(1);
}

try {
  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      ProductName: 'Deceive',
      FileDescription: 'Appear offline in League of Legends, VALORANT, and other Riot games',
      CompanyName: 'League Deceiver',
      LegalCopyright: 'GPL-3.0 License',
      OriginalFilename: 'deceive-node-win.exe',
    },
    'file-version': '1.0.0',
    'product-version': '1.0.0',
  });
  console.log('Icon and version info added successfully!');
} catch (err) {
  console.error('Failed to add icon:', err.message);
  // Don't fail the build if icon injection fails
  process.exit(0);
}
