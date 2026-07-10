import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { encryptAESGCM, deriveKeyFromPassword } from './security';

const DB_NAME = 'nexus_ml_index.db';
const TENSORS_DIR = FileSystem.documentDirectory + 'ml_tensors/';

let db: SQLite.SQLiteDatabase | null = null;

async function initDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS tensors (id TEXT PRIMARY KEY, date TEXT, path TEXT, type TEXT)`
    );
  }
  return db;
}

async function ensureDir() {
  const dirInfo = await FileSystem.getInfoAsync(TENSORS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(TENSORS_DIR, { intermediates: true });
  }
}

export async function saveTensor(
  id: string,
  date: string,
  type: string,
  flatbufferData: string,
  passwordForEncryption: string
): Promise<void> {
  const activeDb = await initDb();
  await ensureDir();

  // 1. Derive the key using the password
  // (In the context of ML Storage, we only derive without supplying a custom salt to let the underlying helper use defaults)
  const { key } = deriveKeyFromPassword(passwordForEncryption);

  // 2. Encrypt the data
  const encryptedPayload = encryptAESGCM(flatbufferData, key);

  // 3. Write to file
  const path = TENSORS_DIR + id + '.bin';
  await FileSystem.writeAsStringAsync(path, encryptedPayload, {
    encoding: FileSystem.EncodingType.UTF8
  });

  // 4. Insert a row into the SQLite tensors table
  try {
    await activeDb.runAsync(
      `INSERT INTO tensors (id, date, path, type) VALUES (?, ?, ?, ?)`,
      [id, date, path, type]
    );
  } catch (error) {
    // CRITICAL GUARDRAIL: If the insert fails, delete the .bin file from the filesystem
    try {
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(path);
      }
    } catch (fsError) {
      console.error('Failed to delete orphaned blob during rollback:', fsError);
    }
    throw error;
  }
}
