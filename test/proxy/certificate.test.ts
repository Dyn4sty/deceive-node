/**
 * Certificate generation tests
 */

import { getCertificate } from '../../src/proxy/certificate.js';

describe('Certificate', () => {
  it('should generate a valid certificate', () => {
    const cert = getCertificate();

    expect(cert).toBeDefined();
    expect(cert.certificate).toContain('-----BEGIN CERTIFICATE-----');
    expect(cert.privateKey).toContain('-----BEGIN RSA PRIVATE KEY-----');
  });

  it('should return the same certificate on subsequent calls', () => {
    const cert1 = getCertificate();
    const cert2 = getCertificate();

    expect(cert1.certificate).toBe(cert2.certificate);
    expect(cert1.privateKey).toBe(cert2.privateKey);
  });
});
