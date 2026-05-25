import { Exercise } from './trainingTypes';

export const EXERCISE_LIBRARY: Record<string, Exercise> = {
  // PUSH
  'bench-press': { id: 'bench-press', name: 'Bench Press', muscleGroup: 'push', equipment: 'barbell', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'overhead-press': { id: 'overhead-press', name: 'Overhead Press', muscleGroup: 'push', equipment: 'barbell', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'incline-bench-press': { id: 'incline-bench-press', name: 'Incline Bench Press', muscleGroup: 'push', equipment: 'barbell', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'dumbbell-bench-press': { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', muscleGroup: 'push', equipment: 'dumbbell', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'dumbbell-shoulder-press': { id: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', muscleGroup: 'push', equipment: 'dumbbell', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'lateral-raise': { id: 'lateral-raise', name: 'Lateral Raise', muscleGroup: 'push', equipment: 'dumbbell', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'cable-lateral-raise': { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', muscleGroup: 'push', equipment: 'cable', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'cable-chest-fly': { id: 'cable-chest-fly', name: 'Cable Chest Fly', muscleGroup: 'push', equipment: 'cable', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'chest-press-machine': { id: 'chest-press-machine', name: 'Chest Press Machine', muscleGroup: 'push', equipment: 'machine', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'tricep-pushdown': { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscleGroup: 'push', equipment: 'cable', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'overhead-tricep-ext': { id: 'overhead-tricep-ext', name: 'Overhead Tricep Extension', muscleGroup: 'push', equipment: 'cable', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'dips': { id: 'dips', name: 'Dips', muscleGroup: 'push', equipment: 'bodyweight', incrementStep: 1, isCustom: false, weightUnit: 'kg' },

  // PULL
  'barbell-row': { id: 'barbell-row', name: 'Barbell Row', muscleGroup: 'pull', equipment: 'barbell', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'lat-pulldown': { id: 'lat-pulldown', name: 'Lat Pulldown', muscleGroup: 'pull', equipment: 'cable', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'pull-ups': { id: 'pull-ups', name: 'Pull-ups', muscleGroup: 'pull', equipment: 'bodyweight', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'chin-ups': { id: 'chin-ups', name: 'Chin-ups', muscleGroup: 'pull', equipment: 'bodyweight', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'seated-cable-row': { id: 'seated-cable-row', name: 'Seated Cable Row', muscleGroup: 'pull', equipment: 'cable', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'dumbbell-row': { id: 'dumbbell-row', name: 'Dumbbell Row', muscleGroup: 'pull', equipment: 'dumbbell', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'bicep-curl': { id: 'bicep-curl', name: 'Bicep Curl', muscleGroup: 'pull', equipment: 'dumbbell', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'hammer-curl': { id: 'hammer-curl', name: 'Hammer Curl', muscleGroup: 'pull', equipment: 'dumbbell', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'cable-bicep-curl': { id: 'cable-bicep-curl', name: 'Cable Bicep Curl', muscleGroup: 'pull', equipment: 'cable', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  'face-pull': { id: 'face-pull', name: 'Face Pull', muscleGroup: 'pull', equipment: 'cable', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
  
  // LEGS
  'squat': { id: 'squat', name: 'Squat', muscleGroup: 'legs', equipment: 'barbell', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'deadlift': { id: 'deadlift', name: 'Deadlift', muscleGroup: 'legs', equipment: 'barbell', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'romanian-deadlift': { id: 'romanian-deadlift', name: 'Romanian Deadlift (RDL)', muscleGroup: 'legs', equipment: 'barbell', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'leg-press': { id: 'leg-press', name: 'Leg Press', muscleGroup: 'legs', equipment: 'machine', incrementStep: 5, isCustom: false, weightUnit: 'kg' },
  'leg-extension': { id: 'leg-extension', name: 'Leg Extension', muscleGroup: 'legs', equipment: 'machine', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'leg-curl': { id: 'leg-curl', name: 'Leg Curl', muscleGroup: 'legs', equipment: 'machine', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'calf-raise': { id: 'calf-raise', name: 'Calf Raise', muscleGroup: 'legs', equipment: 'machine', incrementStep: 2.5, isCustom: false, weightUnit: 'kg' },
  'bulgarian-split-squat': { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', muscleGroup: 'legs', equipment: 'dumbbell', incrementStep: 1, isCustom: false, weightUnit: 'kg' },
};
