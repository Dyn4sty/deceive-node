#!/usr/bin/env node
/**
 * Icon Injection Script
 *
 * Adds the application icon and version metadata to the Windows executable using rcedit.
 * Run after building the Windows executable but BEFORE signing.
 */

import rcedit from 'rcedit';
import {
  defaultExePath,
  defaultIconPath,
  validateFileExists,
  getPackageMetadata,
  logStep,
  logSuccess,
  logError,
  logInfo,
} from './utils.mjs';

// Get paths
const exePath = process.argv[2] ?? defaultExePath;
const iconPath = process.argv[3] ?? defaultIconPath;

async function main() {
  console.log('Windows Executable Icon Injection');
  console.log('==================================');

  // Validate executable exists
  const exeValidation = validateFileExists(exePath, 'Executable');
  if (!exeValidation.exists) {
    logInfo(`Executable not found: ${exePath}`);
    logInfo('Skipping icon injection (this is normal for non-Windows builds).');
    process.exit(0);
  }

  // Validate icon exists
  const iconValidation = validateFileExists(iconPath, 'Icon');
  if (!iconValidation.exists) {
    logError(iconValidation.error);
    process.exit(1);
  }

  logStep('Configuration');
  logInfo(`Executable: ${exePath}`);
  logInfo(`Icon: ${iconPath}`);

  // Get metadata from package.json
  const metadata = getPackageMetadata();

  logStep('Injecting icon and metadata...');

  try {
    await rcedit(exePath, {
      icon: iconPath,
      'version-string': {
        ProductName: metadata.productName,
        FileDescription: metadata.description,
        CompanyName: metadata.companyName,
        LegalCopyright: `${metadata.license} License`,
        OriginalFilename: metadata.originalFilename,
      },
      'file-version': metadata.version,
      'product-version': metadata.version,
    });

    logSuccess('Icon and version info added successfully!');
    logInfo(`Product: ${metadata.productName} v${metadata.version}`);
  } catch (err) {
    logError(`Failed to add icon: ${err.message}`);
    // Don't fail the build if icon injection fails
    process.exit(0);
  }
}

main().catch((err) => {
  logError(err instanceof Error ? err.message : String(err));
  process.exit(0);
});
