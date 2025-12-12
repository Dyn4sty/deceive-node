#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Self-Signed Certificate Generator for Code Signing
 *
 * Generates a self-signed code signing certificate using PowerShell.
 * This is for development/testing purposes only.
 *
 * Usage:
 *   node scripts/generate-cert.mjs [subject-name] [password] [validity-years]
 *
 * Environment variables:
 *   CERT_SUBJECT  - Certificate subject name (CN=...)
 *   CERT_PASSWORD - Password for the PFX file
 *   CERT_YEARS    - Validity period in years (default: 2)
 *
 * Note: Self-signed certificates will show "Unknown Publisher" warnings
 * unless installed to the Trusted Root Certificate Authorities store.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createInterface } from 'readline';
import {
  certsDir,
  getPackageMetadata,
  logStep,
  logSuccess,
  logError,
  logInfo,
  logWarning,
} from './utils.mjs';

// Parse arguments
const subjectArg = process.argv[2] ?? process.env.CERT_SUBJECT;
const passwordArg = process.argv[3] ?? process.env.CERT_PASSWORD;
const yearsArg = parseInt(process.argv[4] ?? process.env.CERT_YEARS ?? '2', 10);

/**
 * Prompt user for input
 * @param {string} question - Question to ask
 * @param {string} [defaultValue] - Default value if user presses enter
 * @returns {Promise<string>}
 */
function prompt(question, defaultValue = '') {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const displayQuestion = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Generate a random password
 * @param {number} length - Password length
 * @returns {string}
 */
function generatePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Generate self-signed certificate using PowerShell
 * @param {string} subject - Certificate subject (CN=...)
 * @param {string} password - PFX password
 * @param {number} years - Validity period in years
 * @param {string} outputPath - Path for the PFX file
 * @returns {{success: boolean, thumbprint?: string, error?: string}}
 */
function generateCertificate(subject, password, years, outputPath) {
  // Ensure subject starts with CN=
  const fullSubject = subject.startsWith('CN=') ? subject : `CN=${subject}`;

  // Escape single quotes in password for PowerShell
  const escapedPassword = password.replace(/'/g, "''");

  // Write PowerShell script to temp file to avoid escaping issues
  const psScript = `
$ErrorActionPreference = 'Stop'

try {
    # Create self-signed code signing certificate
    $cert = New-SelfSignedCertificate \`
        -Type CodeSigningCert \`
        -Subject "${fullSubject}" \`
        -KeyAlgorithm RSA \`
        -KeyLength 2048 \`
        -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" \`
        -CertStoreLocation "Cert:\\CurrentUser\\My" \`
        -FriendlyName "League Deceiver Code Signing" \`
        -NotAfter (Get-Date).AddYears(${years}) \`
        -KeyExportPolicy Exportable \`
        -KeyUsage DigitalSignature \`
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")
    
    # Export to PFX
    $securePassword = ConvertTo-SecureString -String '${escapedPassword}' -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath "${outputPath.replace(/\\/g, '/')}" -Password $securePassword | Out-Null
    
    # Output the thumbprint
    Write-Output $cert.Thumbprint
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
`;

  const tempScriptPath = join(tmpdir(), `generate-cert-${Date.now()}.ps1`);

  try {
    // Write script to temp file
    writeFileSync(tempScriptPath, psScript, 'utf-8');

    // Execute the script
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    return {
      success: true,
      thumbprint: result.trim(),
    };
  } catch (err) {
    const errorMsg = err.stderr?.toString() ?? err.stdout?.toString() ?? err.message;
    return {
      success: false,
      error: errorMsg ?? String(err instanceof Error ? err.message : String(err)),
    };
  } finally {
    // Clean up temp script
    try {
      if (existsSync(tempScriptPath)) {
        unlinkSync(tempScriptPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function main() {
  console.log('Self-Signed Code Signing Certificate Generator');
  console.log('===============================================');
  logWarning('This generates a SELF-SIGNED certificate for TESTING only.');
  logWarning('Users will see "Unknown Publisher" warnings unless they trust it.');

  // Check if on Windows
  if (process.platform !== 'win32') {
    logError('This script requires Windows with PowerShell.');
    process.exit(1);
  }

  // Get metadata for default values
  const metadata = getPackageMetadata();

  // Get certificate subject
  let subject = subjectArg;
  if (!subject) {
    const defaultSubject = `${metadata.productName} Development`;
    subject = await prompt('Certificate subject name', defaultSubject);
  }

  // Get password
  let password = passwordArg;
  if (!password) {
    const generatedPassword = generatePassword();
    console.log('');
    logInfo(`Generated password: ${generatedPassword}`);
    password = await prompt(
      'Certificate password (or press Enter to use generated)',
      generatedPassword
    );
  }

  // Validity period
  const years = yearsArg;

  // Ensure certs directory exists
  if (!existsSync(certsDir)) {
    mkdirSync(certsDir, { recursive: true });
  }

  // Output path
  const outputPath = join(certsDir, 'code-signing.pfx');

  // Check if certificate already exists
  if (existsSync(outputPath)) {
    const overwrite = await prompt('Certificate already exists. Overwrite? (y/N)', 'n');
    if (overwrite.toLowerCase() !== 'y') {
      logInfo('Aborted.');
      process.exit(0);
    }
  }

  logStep('Generating certificate...');
  logInfo(`Subject: CN=${subject}`);
  logInfo(`Validity: ${years} years`);
  logInfo(`Output: ${outputPath}`);

  const result = generateCertificate(subject, password, years, outputPath);

  if (!result.success) {
    logError(`Failed to generate certificate: ${result.error}`);
    process.exit(1);
  }

  logSuccess('Certificate generated successfully!');
  console.log('');
  logInfo(`Thumbprint: ${result.thumbprint}`);
  logInfo(`File: ${outputPath}`);
  logInfo(`Password: ${password}`);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('1. To sign executables:');
  console.log('');
  console.log(`   PFX_PATH="${outputPath}" PFX_PASSWORD="${password}" bun run sign:win`);
  console.log('');
  console.log('2. To trust the certificate locally (removes "Unknown Publisher" warning):');
  console.log('   Run PowerShell as Administrator and execute:');
  console.log('');
  console.log(`   $password = ConvertTo-SecureString -String '${password}' -Force -AsPlainText`);
  console.log(
    `   Import-PfxCertificate -FilePath "${outputPath}" -CertStoreLocation Cert:\\LocalMachine\\Root -Password $password`
  );
  console.log('');
  console.log('3. To remove the certificate from your store later:');
  console.log('');
  console.log(
    `   Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Thumbprint -eq "${result.thumbprint}" } | Remove-Item`
  );
  console.log('');

  // Create .gitignore in certs directory
  const gitignorePath = join(certsDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    const { writeFileSync } = await import('fs');
    writeFileSync(
      gitignorePath,
      '# Ignore certificate files - NEVER commit these!\n*.pfx\n*.p12\n*.pem\n*.key\n'
    );
    logInfo('Created certs/.gitignore to protect certificate files');
  }
}

main().catch((err) => {
  logError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
