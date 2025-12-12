/**
 * Certificate generation and management for TLS interception
 */

import forge from 'node-forge';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDataDir } from '../config/config.js';
import { logger } from '../utils/logger.js';

const CERT_FILENAME = 'deceive-cert.pem';
const KEY_FILENAME = 'deceive-key.pem';

interface CertificateResult {
  certificate: string;
  privateKey: string;
}

let cachedCertificate: CertificateResult | null = null;

/**
 * Generate a self-signed certificate for TLS interception
 */
function generateCertificate(): CertificateResult {
  logger.info('Generating new self-signed certificate...');

  // Generate key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  const attrs = [
    { name: 'commonName', value: 'League Deceiver CA' },
    { name: 'countryName', value: 'US' },
    { name: 'organizationName', value: 'League Deceiver' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      keyEncipherment: true,
    },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ],
    },
  ]);

  // Self-sign
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certificate = forge.pki.certificateToPem(cert);
  const privateKey = forge.pki.privateKeyToPem(keys.privateKey);

  return { certificate, privateKey };
}

/**
 * Get the certificate paths
 */
function getCertPaths(): { certPath: string; keyPath: string } {
  const dataDir = getDataDir();
  return {
    certPath: join(dataDir, CERT_FILENAME),
    keyPath: join(dataDir, KEY_FILENAME),
  };
}

/**
 * Load or generate certificate
 */
export function getCertificate(): CertificateResult {
  if (cachedCertificate) {
    return cachedCertificate;
  }

  const { certPath, keyPath } = getCertPaths();

  // Check if certificate already exists
  if (existsSync(certPath) && existsSync(keyPath)) {
    logger.debug('Loading existing certificate');
    cachedCertificate = {
      certificate: readFileSync(certPath, 'utf-8'),
      privateKey: readFileSync(keyPath, 'utf-8'),
    };
    return cachedCertificate;
  }

  // Generate new certificate
  cachedCertificate = generateCertificate();

  // Save to disk
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  writeFileSync(certPath, cachedCertificate.certificate);
  writeFileSync(keyPath, cachedCertificate.privateKey);
  logger.info(`Certificate saved to ${certPath}`);

  return cachedCertificate;
}

/**
 * Setup certificates (called from CLI setup command)
 */
export function setupCertificates() {
  logger.info('Setting up certificates...');

  getCertificate();
  const { certPath } = getCertPaths();

  logger.info(`Certificate generated at: ${certPath}`);
  logger.info('');
  logger.info('Note: The Riot Client allows self-signed certificates when');
  logger.info('chat.allow_bad_cert.enabled is set to true in the config.');
  logger.info('League Deceiver automatically enables this setting.');
  logger.info('');
  logger.info('Setup complete!');
}
