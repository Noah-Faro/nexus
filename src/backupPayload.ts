import type { Tombstone } from './tombstones';
import type { Exercise, ExerciseDefaults, WorkoutSession, WorkoutTemplate } from './trainingTypes';
import type { DrinkLog, UserSettings } from './types';

export interface VaultBackupStateInput {
  exportedAt: string;
  logs: DrinkLog[];
  settings: UserSettings;
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  customExercises: Exercise[];
  exerciseDefaults: Record<string, ExerciseDefaults>;
  tombstones: Tombstone[];
}

/** Deliberately excludes local transaction journals and other recovery internals. */
export function buildVaultBackupState(input: VaultBackupStateInput) {
  return {
    version: '1.0',
    exportedAt: input.exportedAt,
    hydration_history: input.logs,
    settings: input.settings,
    workout_sessions: input.sessions,
    workout_templates: input.templates,
    custom_exercises: input.customExercises,
    exercise_defaults: input.exerciseDefaults,
    tombstones: input.tombstones,
  };
}
