#!/usr/bin/env node
/**
 * Windows Executable Signing Script
 *
 * Signs the Windows executable using Microsoft SignTool.
 * Requires a code signing certificate (.pfx file) and password.
 *
 * Usage:
 *   node scripts/sign-exe.mjs [path-to-exe] [path-to-pfx] [pfx-password]
 *
 * Environment variables:
 *   PFX_BASE64    - Base64 encoded .pfx file (for CI/CD)
 *   PFX_PATH      - Path to .pfx certificate file
 *   PFX_PASSWORD  - Certificate password
 *   SIGNTOOL_PATH - Optional path to signtool.exe
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  defaultExePath,
  validateFileExists,
  getPackageMetadata,
  logStep,
  logSuccess,
  logError,
  logInfo,
  logWarning,
} from './utils.mjs';

// Timestamp servers to try in order (fallback if one fails)
const TIMESTAMP_SERVERS = [
  'http://timestamp.digicert.com',
  'http://timestamp.sectigo.com',
  'http://timestamp.globalsign.com/tsa/r6advanced1',
];

// Windows SDK versions to search for SignTool
const SDK_VERSIONS = [
  '10.0.26100.0',
  '10.0.22621.0',
  '10.0.22000.0',
  '10.0.19041.0',
  '10.0.18362.0',
];

// Parse arguments
const exePath = process.argv[2] ?? defaultExePath;
const pfxBase64 = process.env.PFX_BASE64;
const pfxPath = process.env.PFX_PATH ?? process.argv[3];
const pfxPassword = process.env.PFX_PASSWORD ?? process.argv[4];

let tempPfxPath = null;

/**
 * Find SignTool in Windows SDK locations
 * @returns {string|null} Path to signtool.exe or null if not found
 */
function findSignTool() {
  // Try custom path first
  if (process.env.SIGNTOOL_PATH && existsSync(process.env.SIGNTOOL_PATH)) {
    return process.env.SIGNTOOL_PATH;
  }

  // Try to find it in PATH first
  try {
    execSync('where signtool', { stdio: 'ignore' });
    return 'signtool';
  } catch {
    // Not in PATH, continue searching
  }

  // Search Windows SDK locations
  const sdkBasePaths = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin',
    'C:\\Program Files\\Windows Kits\\10\\bin',
  ];

  for (const basePath of sdkBasePaths) {
    if (!existsSync(basePath)) continue;

    // Try known SDK versions
    for (const version of SDK_VERSIONS) {
      for (const arch of ['x64', 'x86']) {
        const signtoolPath = join(basePath, version, arch, 'signtool.exe');
        if (existsSync(signtoolPath)) {
          return signtoolPath;
        }
      }
    }

    // Dynamically search for any version
    try {
      const dirs = readdirSync(basePath, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith('10.'))
        .map((d) => d.name)
        .sort()
        .reverse(); // Newest first

      for (const version of dirs) {
        for (const arch of ['x64', 'x86']) {
          const signtoolPath = join(basePath, version, arch, 'signtool.exe');
          if (existsSync(signtoolPath)) {
            return signtoolPath;
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return null;
}

/**
 * Validate certificate using PowerShell
 * @param {string} certPath - Path to .pfx file
 * @param {string} password - Certificate password
 * @returns {{valid: boolean, info?: object, error?: string}}
 */
function validateCertificate(certPath, password) {
  logStep('Validating certificate...');

  try {
    // Use PowerShell to read certificate info
    const psCommand = `
      $ErrorActionPreference = 'Stop'
      $password = ConvertTo-SecureString -String '${password.replace(/'/g, "''")}' -Force -AsPlainText
      try {
        $cert = Get-PfxCertificate -FilePath '${certPath.replace(/'/g, "''")}' -Password $password
        $now = Get-Date
        $isExpired = $cert.NotAfter -lt $now
        $isNotYetValid = $cert.NotBefore -gt $now
        $hasCodeSigningEku = $cert.EnhancedKeyUsageList | Where-Object { $_.ObjectId -eq '1.3.6.1.5.5.7.3.3' }
        
        Write-Output "Subject: $($cert.Subject)"
        Write-Output "Issuer: $($cert.Issuer)"
        Write-Output "Thumbprint: $($cert.Thumbprint)"
        Write-Output "ValidFrom: $($cert.NotBefore.ToString('yyyy-MM-dd'))"
        Write-Output "ValidTo: $($cert.NotAfter.ToString('yyyy-MM-dd'))"
        Write-Output "IsExpired: $isExpired"
        Write-Output "IsNotYetValid: $isNotYetValid"
        Write-Output "HasCodeSigningEKU: $($null -ne $hasCodeSigningEku)"
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    const result = execSync(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse the output
    const lines = result.trim().split('\n');
    const info = {};
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        info[key.trim()] = valueParts.join(':').trim();
      }
    }

    // Display certificate info
    logInfo(`Subject: ${info.Subject ?? 'Unknown'}`);
    logInfo(`Issuer: ${info.Issuer ?? 'Unknown'}`);
    logInfo(`Valid: ${info.ValidFrom ?? '?'} to ${info.ValidTo ?? '?'}`);
    logInfo(`Thumbprint: ${info.Thumbprint ?? 'Unknown'}`);

    // Check for issues
    if (info.IsExpired === 'True') {
      return { valid: false, info, error: 'Certificate has expired' };
    }

    if (info.IsNotYetValid === 'True') {
      return { valid: false, info, error: 'Certificate is not yet valid' };
    }

    if (info.HasCodeSigningEKU === 'False') {
      logWarning('Certificate may not have Code Signing EKU - signing might fail');
    }

    return { valid: true, info };
  } catch (err) {
    // Try to extract meaningful error
    const errorMsg = err.stderr?.toString() || err.message;
    if (
      errorMsg.includes('password') ||
      errorMsg.includes('The specified network password is not correct')
    ) {
      return { valid: false, error: 'Invalid certificate password' };
    }
    if (errorMsg.includes('Cannot find path')) {
      return { valid: false, error: 'Certificate file not found' };
    }
    return { valid: false, error: `Failed to validate certificate: ${errorMsg}` };
  }
}

/**
 * Sign executable with fallback timestamp servers
 * @param {string} signtool - Path to signtool.exe
 * @param {string} exePath - Path to executable
 * @param {string} certPath - Path to .pfx certificate
 * @param {string} password - Certificate password
 * @param {object} metadata - Package metadata for signature
 * @returns {boolean} True if signing succeeded
 */
function signExecutable(signtool, exePath, certPath, password, metadata) {
  const description = metadata.productName || metadata.name;
  const url = metadata.repositoryUrl;

  for (const timestampUrl of TIMESTAMP_SERVERS) {
    try {
      logInfo(`Trying timestamp server: ${timestampUrl}`);

      // Build sign command with metadata
      let signCommand = `"${signtool}" sign /f "${certPath}" /p "${password}" /fd SHA256 /tr ${timestampUrl} /td SHA256`;

      // Add description if available
      if (description) {
        signCommand += ` /d "${description}"`;
      }

      // Add URL if available
      if (url) {
        signCommand += ` /du "${url}"`;
      }

      signCommand += ` "${exePath}"`;

      execSync(signCommand, { stdio: 'inherit' });
      return true;
    } catch (err) {
      logWarning(`Timestamp server ${timestampUrl} failed, trying next...`);
    }
  }

  // Last resort: sign without timestamp (not recommended for production)
  logWarning('All timestamp servers failed. Signing without timestamp...');
  try {
    let signCommand = `"${signtool}" sign /f "${certPath}" /p "${password}" /fd SHA256`;
    if (description) signCommand += ` /d "${description}"`;
    if (url) signCommand += ` /du "${url}"`;
    signCommand += ` "${exePath}"`;

    execSync(signCommand, { stdio: 'inherit' });
    logWarning('Signed without timestamp - signature will expire with certificate!');
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify the signature on an executable
 * @param {string} signtool - Path to signtool.exe
 * @param {string} exePath - Path to executable
 * @returns {boolean} True if verification succeeded
 */
function verifySignature(signtool, exePath) {
  try {
    execSync(`"${signtool}" verify /pa "${exePath}"`, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

// Main execution
async function main() {
  console.log('Windows Executable Signing');
  console.log('==========================');

  // Validate executable exists
  const exeValidation = validateFileExists(exePath, 'Executable');
  if (!exeValidation.exists) {
    logError(exeValidation.error);
    process.exit(1);
  }

  // Handle base64 encoded certificate (for GitHub Actions)
  let actualPfxPath = pfxPath;
  if (pfxBase64 && !pfxPath) {
    try {
      tempPfxPath = join(tmpdir(), `signing-cert-${Date.now()}.pfx`);
      const pfxBuffer = Buffer.from(pfxBase64, 'base64');
      writeFileSync(tempPfxPath, pfxBuffer);
      actualPfxPath = tempPfxPath;
      logInfo('Decoded certificate from base64');
    } catch (err) {
      logError(`Failed to decode base64 certificate: ${err.message}`);
      process.exit(1);
    }
  }

  // Validate certificate path
  const certValidation = validateFileExists(actualPfxPath, 'Certificate (.pfx)');
  if (!certValidation.exists) {
    logError(certValidation.error);
    console.error('\nOptions:');
    console.error('  1. Set PFX_BASE64 environment variable (base64 encoded .pfx file)');
    console.error('  2. Set PFX_PATH environment variable (path to .pfx file)');
    console.error(
      '  3. Provide as argument: node scripts/sign-exe.mjs <exe> <pfx-path> <password>'
    );
    process.exit(1);
  }

  // Validate password provided
  if (!pfxPassword) {
    logError('Certificate password not provided');
    console.error('Set PFX_PASSWORD environment variable or provide as argument');
    process.exit(1);
  }

  // Find SignTool
  const signtool = findSignTool();
  if (!signtool) {
    logError('SignTool not found. Please install Windows SDK.');
    console.error(
      'Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/'
    );
    process.exit(1);
  }

  logStep('Configuration');
  logInfo(`SignTool: ${signtool}`);
  logInfo(`Executable: ${exePath}`);

  // Validate certificate
  // const certResult = validateCertificate(actualPfxPath, pfxPassword);
  // if (!certResult.valid) {
  //   logError(certResult.error);
  //   process.exit(1);
  // }

  // Get package metadata for signature
  const metadata = getPackageMetadata();

  // Sign the executable
  logStep('Signing executable...');
  const signSuccess = signExecutable(signtool, exePath, actualPfxPath, pfxPassword, metadata);

  if (!signSuccess) {
    logError('Failed to sign executable');
    cleanup();
    process.exit(1);
  }

  // Verify the signature
  logStep('Verifying signature...');
  const verifySuccess = verifySignature(signtool, exePath);

  if (verifySuccess) {
    logSuccess('Executable signed and verified successfully!');
  } else {
    logWarning('Signature verification failed - the signature may not be trusted');
  }

  cleanup();
}

function cleanup() {
  // Clean up temp file if we created one
  if (tempPfxPath && existsSync(tempPfxPath)) {
    try {
      unlinkSync(tempPfxPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

main().catch((err) => {
  logError(err.message);
  cleanup();
  process.exit(1);
});
