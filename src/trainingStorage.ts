import {
  loadFromStorageResult,
  saveToStorage,
  saveToStorageStrict,
  type StorageLoadResult,
  type StorageLoadStatus,
} from './utils';
import { WorkoutSession, WorkoutTemplate, Exercise, ExerciseDefaults } from './trainingTypes';
import { createDefaultWorkoutTemplates } from './trainingDefaults';
import {
  decodeActiveSession,
  decodeCustomExercises,
  decodeExerciseDefaults,
  decodeWorkoutSessions,
  decodeWorkoutTemplates,
  TRAINING_STORAGE_DECODER_VERSION,
  type TrainingDecodeIssue,
} from './trainingDecoders';
import { TRAINING_SESSIONS_STORAGE_KEY } from './trainingStorageKeys';
import { SerializedAsyncQueue } from './serializedAsyncQueue';
export { recoveryHistoryCompletenessForStatus } from './trainingDecoders';

const TEMPLATES_KEY = '@nexus_training_templates';
const CUSTOM_EXERCISES_KEY = '@nexus_training_custom_exercises';
const EXERCISE_DEFAULTS_KEY = '@nexus_training_exercise_defaults';

export type TrainingStorageLoadResult<T> = StorageLoadResult<T, TrainingDecodeIssue>;

export class TrainingStorageLoadError extends Error {
  readonly result: TrainingStorageLoadResult<unknown>;

  constructor(result: TrainingStorageLoadResult<unknown>) {
    super(`Training storage key ${result.key} has load status ${result.status}.`);
    this.name = 'TrainingStorageLoadError';
    this.result = result;
  }
}

function unwrapLoadResult<T>(result: TrainingStorageLoadResult<T>): T {
  if (result.status === 'valid' || result.status === 'absent') return result.value;
  throw new TrainingStorageLoadError(result as TrainingStorageLoadResult<unknown>);
}

export function loadStatusNeedsAttention(status: StorageLoadStatus): boolean {
  return status === 'invalid' || status === 'unreadable' || status === 'locked';
}

export async function loadWorkoutSessionsResult(): Promise<TrainingStorageLoadResult<WorkoutSession[]>> {
  return loadFromStorageResult(TRAINING_SESSIONS_STORAGE_KEY, {
    decoderVersion: TRAINING_STORAGE_DECODER_VERSION,
    absentValue: [],
    failureValue: [],
    decode: decodeWorkoutSessions,
  });
}

export async function loadWorkoutSessions(): Promise<WorkoutSession[]> {
  return unwrapLoadResult(await loadWorkoutSessionsResult());
}

export async function saveWorkoutSessions(sessions: WorkoutSession[]): Promise<void> {
  return saveToStorageStrict<WorkoutSession[]>(TRAINING_SESSIONS_STORAGE_KEY, sessions);
}

export async function loadTemplates(): Promise<WorkoutTemplate[]> {
  return unwrapLoadResult(await loadTemplatesResult());
}

export async function loadTemplatesResult(): Promise<TrainingStorageLoadResult<WorkoutTemplate[]>> {
  return loadFromStorageResult(TEMPLATES_KEY, {
    decoderVersion: TRAINING_STORAGE_DECODER_VERSION,
    absentValue: createDefaultWorkoutTemplates(),
    failureValue: [],
    decode: decodeWorkoutTemplates,
  });
}

export async function saveTemplates(templates: WorkoutTemplate[]): Promise<void> {
  return saveToStorageStrict<WorkoutTemplate[]>(TEMPLATES_KEY, templates);
}

export async function loadCustomExercises(): Promise<Exercise[]> {
  return unwrapLoadResult(await loadCustomExercisesResult());
}

export async function loadCustomExercisesResult(): Promise<TrainingStorageLoadResult<Exercise[]>> {
  return loadFromStorageResult(CUSTOM_EXERCISES_KEY, {
    decoderVersion: TRAINING_STORAGE_DECODER_VERSION,
    absentValue: [],
    failureValue: [],
    decode: decodeCustomExercises,
  });
}

export async function saveCustomExercises(exercises: Exercise[]): Promise<void> {
  return saveToStorage<Exercise[]>(CUSTOM_EXERCISES_KEY, exercises);
}

export async function loadExerciseDefaults(): Promise<Record<string, ExerciseDefaults>> {
  return unwrapLoadResult(await loadExerciseDefaultsResult());
}

export async function loadExerciseDefaultsResult(): Promise<TrainingStorageLoadResult<Record<string, ExerciseDefaults>>> {
  return loadFromStorageResult(EXERCISE_DEFAULTS_KEY, {
    decoderVersion: TRAINING_STORAGE_DECODER_VERSION,
    absentValue: {},
    failureValue: {},
    decode: decodeExerciseDefaults,
  });
}

export async function saveExerciseDefaults(defaults: Record<string, ExerciseDefaults>): Promise<void> {
  return saveToStorage<Record<string, ExerciseDefaults>>(EXERCISE_DEFAULTS_KEY, defaults);
}

const ACTIVE_SESSION_KEY = '@nexus_training_active_session';
const activeSessionWriteQueue = new SerializedAsyncQueue();

export async function loadActiveSession(): Promise<WorkoutSession | null> {
  return unwrapLoadResult(await loadActiveSessionResult());
}

export async function loadActiveSessionResult(): Promise<TrainingStorageLoadResult<WorkoutSession | null>> {
  return loadFromStorageResult(ACTIVE_SESSION_KEY, {
    decoderVersion: TRAINING_STORAGE_DECODER_VERSION,
    absentValue: null,
    failureValue: null,
    decode: decodeActiveSession,
  });
}

export async function saveActiveSession(session: WorkoutSession | null): Promise<void> {
  return activeSessionWriteQueue.enqueue(
    () => saveToStorage<WorkoutSession | null>(ACTIVE_SESSION_KEY, session),
  );
}

export async function saveActiveSessionStrict(session: WorkoutSession | null): Promise<void> {
  return activeSessionWriteQueue.enqueue(
    () => saveToStorageStrict<WorkoutSession | null>(ACTIVE_SESSION_KEY, session),
  );
}
