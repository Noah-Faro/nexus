import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession, WorkoutTemplate, Exercise } from './trainingTypes';

const SESSIONS_KEY = '@nexus_training_sessions';
const TEMPLATES_KEY = '@nexus_training_templates';
const CUSTOM_EXERCISES_KEY = '@nexus_training_custom_exercises';

export async function loadWorkoutSessions(): Promise<WorkoutSession[]> {
  try {
    const data = await AsyncStorage.getItem(SESSIONS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error loading training sessions', e);
  }
  return [];
}

export async function saveWorkoutSessions(sessions: WorkoutSession[]) {
  try {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Error saving training sessions', e);
  }
}

export async function loadTemplates(): Promise<WorkoutTemplate[]> {
  try {
    const data = await AsyncStorage.getItem(TEMPLATES_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error loading templates', e);
  }
  return DEFAULT_TEMPLATES;
}

export async function saveTemplates(templates: WorkoutTemplate[]) {
  try {
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Error saving templates', e);
  }
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
  try {
    const data = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error loading custom exercises', e);
  }
  return [];
}

export async function saveCustomExercises(exercises: Exercise[]) {
  try {
    await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
  } catch (e) {
    console.error('Error saving custom exercises', e);
  }
}

const EXERCISE_DEFAULTS_KEY = '@nexus_training_exercise_defaults';

export async function loadExerciseDefaults(): Promise<Record<string, { defaultWeight: number, defaultReps: number }>> {
  try {
    const data = await AsyncStorage.getItem(EXERCISE_DEFAULTS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error loading exercise defaults', e);
  }
  return {};
}

export async function saveExerciseDefaults(defaults: Record<string, { defaultWeight: number, defaultReps: number }>) {
  try {
    await AsyncStorage.setItem(EXERCISE_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch (e) {
    console.error('Error saving exercise defaults', e);
  }
}
