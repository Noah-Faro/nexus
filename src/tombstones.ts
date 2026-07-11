import AsyncStorage from '@react-native-async-storage/async-storage';

const TOMBSTONES_KEY = 'nexus_tombstones';

export interface Tombstone {
  id: string;
  deletedAt: number; // Unix timestamp in ms
}

export async function loadTombstonesStrict(): Promise<Tombstone[]> {
  const raw = await AsyncStorage.getItem(TOMBSTONES_KEY);
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(item =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Tombstone).id === 'string' &&
      Number.isFinite((item as Tombstone).deletedAt)
    )
  ) {
    throw new Error('Invalid tombstone storage payload.');
  }
  return parsed as Tombstone[];
}

export async function loadTombstones(): Promise<Tombstone[]> {
  try {
    return await loadTombstonesStrict();
  } catch (e) {
    console.error('Failed to load tombstones:', e);
    return [];
  }
}

export async function saveTombstonesStrict(tombstones: Tombstone[]): Promise<void> {
  await AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify(tombstones));
}

export async function saveTombstones(tombstones: Tombstone[]): Promise<void> {
  try {
    await saveTombstonesStrict(tombstones);
  } catch (e) {
    console.error('Failed to save tombstones:', e);
  }
}

/**
 * Record a single deletion. Appends a tombstone entry for the given ID.
 */
export async function recordDeletion(id: string): Promise<void> {
  const tombstones = await loadTombstones();
  // Avoid duplicates — update deletedAt if already present
  const existing = tombstones.find(t => t.id === id);
  if (existing) {
    existing.deletedAt = Date.now();
  } else {
    tombstones.push({ id, deletedAt: Date.now() });
  }
  await saveTombstones(tombstones);
}

/**
 * Record multiple deletions at once.
 */
export async function recordDeletions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const tombstones = await loadTombstones();
  const now = Date.now();
  for (const id of ids) {
    const existing = tombstones.find(t => t.id === id);
    if (existing) {
      existing.deletedAt = now;
    } else {
      tombstones.push({ id, deletedAt: now });
    }
  }
  await saveTombstones(tombstones);
}

/**
 * Remove tombstone entries older than maxAgeDays to prevent unbounded growth.
 */
export async function pruneTombstones(maxAgeDays: number = 90): Promise<void> {
  const tombstones = await loadTombstones();
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  const pruned = tombstones.filter(t => t.deletedAt >= cutoff);
  if (pruned.length !== tombstones.length) {
    await saveTombstones(pruned);
  }
}
