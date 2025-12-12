#!/usr/bin/env node
/**
 * Shared utilities for build scripts
 *
 * Common functionality used by add-icon.mjs, sign-exe.mjs, and generate-cert.mjs
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import packageJson from '../package.json' with { type: 'json' };
// Get directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));
export const rootDir = join(__dirname, '..');
export const distDir = join(rootDir, 'dist');
export const assetsDir = join(rootDir, 'assets');
export const certsDir = join(rootDir, 'certs');

// Default paths
export const defaultExePath = join(distDir, 'deceive-node-win.exe');
export const defaultIconPath = join(assetsDir, 'logo.ico');

/**
 * Read and parse package.json metadata
 * @returns {Record<string, string>} Package metadata with name, version, description, and repository URL
 */
export function getPackageMetadata() {
  const { name, version, description, repository, license } = packageJson;
  return {
    name: name ?? 'deceive-node',
    version: version ?? '1.0.0',
    description: description ?? '',
    repositoryUrl: repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') ?? '',
    license: license ?? 'GPL-3.0',
    productName: 'Deceive',
    companyName: 'League Deceiver',
    originalFilename: `${name}-win.exe`,
  };
}

/**
 * Find executable path with validation
 * @param {string} [customPath] - Optional cust om path to executable
 * @returns {string|null} Path to executable or null if not found
 */
export function findExecutable(customPath) {
  const exePath = customPath ?? defaultExePath;

  if (existsSync(exePath)) {
    return exePath;
  }

  return null;
}

/**
 * Validate that a file exists
 * @param {string} filePath - Path to validate
 * @param {string} [fileDescription] - Description for error message
 * @returns {{exists: boolean, path: string, error?: string}}
 */
export function validateFileExists(filePath, fileDescription = 'File') {
  if (!filePath) {
    return {
      exists: false,
      path: filePath,
      error: `${fileDescription} path not provided`,
    };
  }

  if (!existsSync(filePath)) {
    return {
      exists: false,
      path: filePath,
      error: `${fileDescription} not found: ${filePath}`,
    };
  }

  return {
    exists: true,
    path: filePath,
  };
}

/**
 * Log a step/progress message with consistent formatting
 * @param {string} message - Message to log
 */
export function logStep(message) {
  console.log(`\n> ${message}`);
}

/**
 * Log a success message with consistent formatting
 * @param {string} message - Message to log
 */
export function logSuccess(message) {
  console.log(`\n✓ ${message}`);
}

/**
 * Log an error message with consistent formatting
 * @param {string} message - Message to log
 */
export function logError(message) {
  console.error(`\n✗ ${message}`);
}

/**
 * Log an info message with consistent formatting
 * @param {string} message - Message to log
 */
export function logInfo(message) {
  console.log(`  ${message}`);
}

/**
 * Log a warning message with consistent formatting
 * @param {string} message - Message to log
 */
export function logWarning(message) {
  console.warn(`⚠ ${message}`);
}
