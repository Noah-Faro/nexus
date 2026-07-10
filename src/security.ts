import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import QuickCrypto from 'react-native-quick-crypto';

const MASTER_KEY_ALIAS = 'nexus_master_key_v1';

/**
 * Retrieves the device-specific 256-bit master key from the Keychain.
 * If it doesn't exist, it generates one securely using expo-crypto.
 * Returns a hex string representation of the key.
 */
export async function getOrGenerateMasterKey(): Promise<string> {
  try {
    let keyHex = await SecureStore.getItemAsync(MASTER_KEY_ALIAS);
    if (!keyHex) {
      // Generate 32 bytes (256-bit key) securely using expo-crypto
      const randomBytes = Crypto.getRandomValues(new Uint8Array(32));
      keyHex = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      await SecureStore.setItemAsync(MASTER_KEY_ALIAS, keyHex, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    return keyHex;
  } catch (e) {
    console.error('Failed to get/set master key:', e);
    // Remove insecure fallback to prevent data wiping when SecureStore is locked.
    throw new Error('SECURE_STORE_LOCKED');
  }
}

/**
 * Encrypts a plaintext string using AES-256-GCM via react-native-quick-crypto.
 * Returns a payload string in the format: iv(hex):authTag(base64):ciphertext(base64)
 */
export function encryptAESGCM(plaintext: string, keyHex: string): string {
  const iv = QuickCrypto.randomBytes(12);
  const key = Buffer.from(keyHex, 'hex');
  const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('base64')}:${ciphertext}`;
}

/**
 * Decrypts a payload string (iv:authTag:ciphertext) using AES-256-GCM via react-native-quick-crypto.
 */
export function decryptAESGCM(payload: string, keyHex: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  
  const [ivHexStr, authTagB64, ciphertext] = parts;
  
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHexStr, 'hex');
  const authTag = Buffer.from(authTagB64, 'base64');
  
  const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag as any);
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Derives a 256-bit key from a user password using PBKDF2 natively.
 */
export function deriveKeyFromPassword(password: string, saltHex?: string): { key: string, salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : QuickCrypto.randomBytes(16);
  const saltHexStr = salt.toString('hex');
  
  const keyBuffer = QuickCrypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  
  return {
    key: keyBuffer.toString('hex'),
    salt: saltHexStr
  };
}

/**
 * [LEGACY] Encrypts a plaintext string using AES-256-CBC with an HMAC-SHA256 signature
 */
export function encryptLegacyAESGCM(plaintext: string, keyHex: string): string {
  // Generate random 16-byte IV securely
  const ivBytes = Crypto.getRandomValues(new Uint8Array(16));
  const ivHexStr = Array.from(ivBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHexStr);
  
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  const ciphertext = encrypted.toString(); // Base64 representation of ciphertext
  
  // Compute HMAC to guarantee integrity (equivalent to GCM's auth tag)
  const hmac = CryptoJS.HmacSHA256(ivHexStr + ciphertext, key).toString(CryptoJS.enc.Base64);
  
  return `${ivHexStr}:${hmac}:${ciphertext}`;
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks on HMAC verification.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * [LEGACY] Decrypts a payload string (iv:hmac:ciphertext) using AES-256-CBC and validates the HMAC integrity.
 */
export function decryptLegacyAESGCM(payload: string, keyHex: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  
  const [ivHexStr, hmacB64, ciphertext] = parts;
  
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHexStr);
  
  // Verify HMAC integrity first (Encrypt-then-MAC) using constant-time comparison
  const expectedHmac = CryptoJS.HmacSHA256(ivHexStr + ciphertext, key).toString(CryptoJS.enc.Base64);
  if (!constantTimeEqual(hmacB64, expectedHmac)) {
    throw new Error('Integrity check failed: payload was tampered with');
  }
  
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
  if (!decryptedStr) {
    throw new Error('Decryption failed: invalid key or corrupted data');
  }
  return decryptedStr;
}

/**
 * [LEGACY] Derives a 256-bit key from a user password using PBKDF2.
 */
export function deriveLegacyKeyFromPassword(password: string, saltHex?: string): { key: string, salt: string } {
  let saltHexStr = saltHex;
  if (!saltHexStr) {
    const saltBytes = Crypto.getRandomValues(new Uint8Array(16));
    saltHexStr = Array.from(saltBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  const salt = CryptoJS.enc.Hex.parse(saltHexStr);
  
  // 10k iterations for extremely high security with excellent pure-JS performance in mobile runtimes
  const derived = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32, // 32 bytes (256 bits)
    iterations: 10000,
    hasher: CryptoJS.algo.SHA256
  });
  
  return {
    key: derived.toString(CryptoJS.enc.Hex),
    salt: saltHexStr
  };
}
