import { safeStorage } from 'electron';

export interface CredentialStore { isAvailable(): boolean; protect(secret: string): Buffer; reveal(value: Buffer): string; }

export class PlatformCredentialStore implements CredentialStore {
  isAvailable() { return safeStorage.isEncryptionAvailable(); }
  protect(secret: string) {
    if (!this.isAvailable()) throw new Error('Secure credential storage is unavailable.');
    return safeStorage.encryptString(secret);
  }
  reveal(value: Buffer) {
    if (!this.isAvailable()) throw new Error('Secure credential storage is unavailable.');
    return safeStorage.decryptString(value);
  }
}
