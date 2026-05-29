import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISE_LIBRARY } from './exerciseLibrary';
import { Exercise } from './trainingTypes';
import { getOrGenerateMasterKey, encryptAESGCM, decryptAESGCM } from './security';

// High-entropy fast unique ID generator (collison-free, pure JS)
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
};

// Centralized decimal hour parsing helper
export const parseTimeToDecimal = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m / 60);
};

// Centralized exercise resolver (combines static library + user synthesized custom exercises)
export const getExerciseById = (id: string, customExercises: Exercise[]): Exercise | undefined => {
  return EXERCISE_LIBRARY[id] || customExercises?.find(c => c.id === id);
};

// Generic type-safe AsyncStorage helpers to dry up boilerplate and provide transparent encryption
export async function loadFromStorage<T>(key: string, fallback: T): Promise<T> {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data) {
      // Check if data looks like an encrypted payload (iv:authTag:ciphertext)
      // Otherwise, assume it's unencrypted legacy data and migrate it.
      if (data.includes(':') && data.split(':').length === 3 && !data.startsWith('{') && !data.startsWith('[')) {
        const keyBuffer = await getOrGenerateMasterKey();
        const decryptedStr = decryptAESGCM(data, keyBuffer);
        return JSON.parse(decryptedStr);
      } else {
        // Fallback for unencrypted data (useful during initial upgrade to encrypted storage)
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error(`Error loading key "${key}" from storage`, e);
  }
  return fallback;
}

export async function saveToStorage<T>(key: string, data: T): Promise<void> {
  try {
    const jsonStr = JSON.stringify(data);
    const keyBuffer = await getOrGenerateMasterKey();
    const encryptedStr = encryptAESGCM(jsonStr, keyBuffer);
    await AsyncStorage.setItem(key, encryptedStr);
  } catch (e) {
    console.error(`Error saving key "${key}" to storage`, e);
  }
}
