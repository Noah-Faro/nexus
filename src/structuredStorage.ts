export type StorageLoadStatus = 'absent' | 'valid' | 'invalid' | 'unreadable' | 'locked';
export type StorageSourceFormat = 'none' | 'legacy_plaintext' | 'encrypted';

interface StorageLoadBase<T> {
  key: string;
  decoderVersion: number;
  sourceFormat: StorageSourceFormat;
  value: T;
}

export type StorageLoadResult<T, TIssue> =
  | (StorageLoadBase<T> & { status: 'absent' | 'valid' })
  | (StorageLoadBase<T> & { status: 'invalid'; issues: readonly TIssue[] })
  | (StorageLoadBase<T> & { status: 'unreadable' | 'locked'; errorMessage: string });

export type StorageDecoderResult<T, TIssue> =
  | { ok: true; value: T; issues: readonly [] }
  | { ok: false; recoverableValue: T; issues: readonly TIssue[] };

export interface StructuredStorageLoadOptions<T, TIssue> {
  decoderVersion: number;
  absentValue: T;
  failureValue: T;
  decode: (value: unknown) => StorageDecoderResult<T, TIssue>;
}

export interface StructuredStorageReadDependencies {
  read: () => Promise<string | null>;
  decrypt: (payload: string) => string | Promise<string>;
}

export interface StructuredStorageWriteDependencies {
  encrypt: (serialized: string) => string | Promise<string>;
  write: (encryptedPayload: string) => void | Promise<void>;
}

function isEncryptedStoragePayload(data: string): boolean {
  const trimmedPrefix = data.trimStart();
  if (trimmedPrefix.startsWith('{') || trimmedPrefix.startsWith('[')) return false;

  const parts = data.split(':');
  if (parts.length !== 3) return false;
  const [ivHex, hmacBase64, ciphertextBase64] = parts;
  const isHexIv = /^[0-9a-f]{32}$/i.test(ivHex);
  const isBase64 = (value: string) =>
    value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  return isHexIv && isBase64(hmacBase64) && isBase64(ciphertextBase64);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failureStatus(error: unknown): 'unreadable' | 'locked' {
  return error instanceof Error && error.message === 'SECURE_STORE_LOCKED'
    ? 'locked'
    : 'unreadable';
}

/** Pure, injected read/decrypt pipeline. It has no write dependency by design. */
export async function loadStructuredStorageValue<T, TIssue>(
  key: string,
  options: StructuredStorageLoadOptions<T, TIssue>,
  dependencies: StructuredStorageReadDependencies,
): Promise<StorageLoadResult<T, TIssue>> {
  let data: string | null;
  try {
    data = await dependencies.read();
  } catch (error) {
    return {
      key,
      status: failureStatus(error),
      decoderVersion: options.decoderVersion,
      sourceFormat: 'none',
      value: options.failureValue,
      errorMessage: errorMessage(error),
    };
  }

  if (data === null) {
    return {
      key,
      status: 'absent',
      decoderVersion: options.decoderVersion,
      sourceFormat: 'none',
      value: options.absentValue,
    };
  }

  const sourceFormat: StorageSourceFormat = isEncryptedStoragePayload(data)
    ? 'encrypted'
    : 'legacy_plaintext';

  let parsed: unknown;
  try {
    const serialized = sourceFormat === 'encrypted'
      ? await dependencies.decrypt(data)
      : data;
    parsed = JSON.parse(serialized);
  } catch (error) {
    return {
      key,
      status: failureStatus(error),
      decoderVersion: options.decoderVersion,
      sourceFormat,
      value: options.failureValue,
      errorMessage: errorMessage(error),
    };
  }

  try {
    const decoded = options.decode(parsed);
    return decoded.ok
      ? {
          key,
          status: 'valid',
          decoderVersion: options.decoderVersion,
          sourceFormat,
          value: decoded.value,
        }
      : {
          key,
          status: 'invalid',
          decoderVersion: options.decoderVersion,
          sourceFormat,
          value: decoded.recoverableValue,
          issues: decoded.issues,
        };
  } catch (error) {
    return {
      key,
      status: 'unreadable',
      decoderVersion: options.decoderVersion,
      sourceFormat,
      value: options.failureValue,
      errorMessage: `Decoder failed: ${errorMessage(error)}`,
    };
  }
}

/** Pure, injected serialize/encrypt/write pipeline. Every failure rejects unchanged. */
export async function saveStructuredStorageValue<T>(
  value: T,
  dependencies: StructuredStorageWriteDependencies,
): Promise<void> {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('Structured storage value is not JSON serializable.');
  }
  const encryptedPayload = await dependencies.encrypt(serialized);
  await dependencies.write(encryptedPayload);
}
