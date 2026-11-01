import type { TemplateExercise, WorkoutTemplate } from './trainingTypes';

export type CanonicalWorkoutPreset = 'push' | 'pull' | 'legs';

export const CANONICAL_TEMPLATE_ID_BY_PRESET = Object.freeze({
  push: 'template-push-a',
  pull: 'template-pull-a',
  legs: 'template-legs-a',
} as const satisfies Readonly<Record<CanonicalWorkoutPreset, string>>);

export type CanonicalWorkoutTemplate = Omit<
  Readonly<WorkoutTemplate>,
  'exercises'
> & {
  readonly exercises: readonly Readonly<TemplateExercise>[];
};

const canonicalTemplate = (
  template: WorkoutTemplate,
): CanonicalWorkoutTemplate =>
  Object.freeze({
    ...template,
    exercises: Object.freeze(
      template.exercises.map((exercise) => Object.freeze({ ...exercise })),
    ),
  });

export const CANONICAL_WORKOUT_TEMPLATES = Object.freeze([
  canonicalTemplate({
    id: CANONICAL_TEMPLATE_ID_BY_PRESET.push,
    name: 'Push A',
    color: '#64d2ff',
    exercises: [
      { exerciseId: 'bench-press', targetSets: 3, targetReps: 8 },
      { exerciseId: 'overhead-press', targetSets: 3, targetReps: 8 },
      { exerciseId: 'lateral-raise', targetSets: 3, targetReps: 12 },
      { exerciseId: 'tricep-pushdown', targetSets: 3, targetReps: 12 },
    ],
  }),
  canonicalTemplate({
    id: CANONICAL_TEMPLATE_ID_BY_PRESET.pull,
    name: 'Pull A',
    color: '#32d74b',
    exercises: [
      { exerciseId: 'barbell-row', targetSets: 3, targetReps: 8 },
      { exerciseId: 'lat-pulldown', targetSets: 3, targetReps: 10 },
      { exerciseId: 'bicep-curl', targetSets: 3, targetReps: 12 },
    ],
  }),
  canonicalTemplate({
    id: CANONICAL_TEMPLATE_ID_BY_PRESET.legs,
    name: 'Legs A',
    color: '#ff9f0a',
    exercises: [
      { exerciseId: 'squat', targetSets: 3, targetReps: 8 },
      { exerciseId: 'romanian-deadlift', targetSets: 3, targetReps: 10 },
      { exerciseId: 'leg-press', targetSets: 3, targetReps: 12 },
      { exerciseId: 'calf-raise', targetSets: 4, targetReps: 15 },
    ],
  }),
]);

/** Mutable seed values for a first-run template store only. */
export function createDefaultWorkoutTemplates(): WorkoutTemplate[] {
  return CANONICAL_WORKOUT_TEMPLATES.map((template) => ({
    ...template,
    exercises: template.exercises.map((exercise) => ({ ...exercise })),
  }));
}
