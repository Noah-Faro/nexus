import { loadFromStorage, saveToStorage } from './utils';
import { WorkoutSession, WorkoutTemplate, Exercise, ExerciseDefaults } from './trainingTypes';

const SESSIONS_KEY = '@nexus_training_sessions';
const TEMPLATES_KEY = '@nexus_training_templates';
const CUSTOM_EXERCISES_KEY = '@nexus_training_custom_exercises';
const EXERCISE_DEFAULTS_KEY = '@nexus_training_exercise_defaults';

export async function loadWorkoutSessions(): Promise<WorkoutSession[]> {
  return loadFromStorage<WorkoutSession[]>(SESSIONS_KEY, []);
}

export async function saveWorkoutSessions(sessions: WorkoutSession[]): Promise<void> {
  return saveToStorage<WorkoutSession[]>(SESSIONS_KEY, sessions);
}

export async function loadTemplates(): Promise<WorkoutTemplate[]> {
  return loadFromStorage<WorkoutTemplate[]>(TEMPLATES_KEY, DEFAULT_TEMPLATES);
}

export async function saveTemplates(templates: WorkoutTemplate[]): Promise<void> {
  return saveToStorage<WorkoutTemplate[]>(TEMPLATES_KEY, templates);
}

const DEFAULT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'template-push-a',
    name: 'Push A',
    color: '#64d2ff',
    exercises: [
      { exerciseId: 'bench-press', targetSets: 3, targetReps: 8 },
      { exerciseId: 'overhead-press', targetSets: 3, targetReps: 8 },
      { exerciseId: 'lateral-raise', targetSets: 3, targetReps: 12 },
      { exerciseId: 'tricep-pushdown', targetSets: 3, targetReps: 12 },
    ]
  },
  {
    id: 'template-pull-a',
    name: 'Pull A',
    color: '#32d74b',
    exercises: [
      { exerciseId: 'barbell-row', targetSets: 3, targetReps: 8 },
      { exerciseId: 'lat-pulldown', targetSets: 3, targetReps: 10 },
      { exerciseId: 'bicep-curl', targetSets: 3, targetReps: 12 },
    ]
  },
  {
    id: 'template-legs-a',
    name: 'Legs A',
    color: '#ff9f0a',
    exercises: [
      { exerciseId: 'squat', targetSets: 3, targetReps: 8 },
      { exerciseId: 'romanian-deadlift', targetSets: 3, targetReps: 10 },
      { exerciseId: 'leg-press', targetSets: 3, targetReps: 12 },
      { exerciseId: 'calf-raise', targetSets: 4, targetReps: 15 },
    ]
  }
];

export async function loadCustomExercises(): Promise<Exercise[]> {
  return loadFromStorage<Exercise[]>(CUSTOM_EXERCISES_KEY, []);
}

export async function saveCustomExercises(exercises: Exercise[]): Promise<void> {
  return saveToStorage<Exercise[]>(CUSTOM_EXERCISES_KEY, exercises);
}

export async function loadExerciseDefaults(): Promise<Record<string, ExerciseDefaults>> {
  return loadFromStorage<Record<string, ExerciseDefaults>>(EXERCISE_DEFAULTS_KEY, {});
}

export async function saveExerciseDefaults(defaults: Record<string, ExerciseDefaults>): Promise<void> {
  return saveToStorage<Record<string, ExerciseDefaults>>(EXERCISE_DEFAULTS_KEY, defaults);
}

const ACTIVE_SESSION_KEY = '@nexus_training_active_session';

export async function loadActiveSession(): Promise<WorkoutSession | null> {
  return loadFromStorage<WorkoutSession | null>(ACTIVE_SESSION_KEY, null);
}

export async function saveActiveSession(session: WorkoutSession | null): Promise<void> {
  return saveToStorage<WorkoutSession | null>(ACTIVE_SESSION_KEY, session);
}
