import { RECOVERY_UNIT_BY_ID, RECOVERY_UNITS } from './definitions';
import { EXERCISE_IMPACT_BY_ID, EXERCISE_IMPACT_GUIDE } from './exerciseImpactGuide';
import type {
  ActivationBudgetId,
  ActivationRole,
  MuscleRecoveryUnitId,
  ResolvedExerciseProfile,
} from './types';

export const ACTIVATION_REGISTRY_VERSION = 'phase11-activation-v1';

export const ROLE_WEIGHTS: Readonly<Record<ActivationRole, number>> = Object.freeze({
  primary: 1,
  secondary: 0.6,
  stabilizer: 0.25,
});

export const QUALITATIVE_EXERCISE_IDS = Object.freeze([
  'plank',
  'treadmill-run',
  'cycling',
  'rowing',
  'stairmaster',
  'side-plank',
  'elliptical',
  'stationary-bike',
  'incline-walking',
  'outdoor-run',
  'jump-rope',
  'swimming',
] as const);

type ActivationBudgetTable = Readonly<
  Record<string, Readonly<Partial<Record<ActivationBudgetId, number>>>>
>;

export const ACTIVATION_BUDGET_REGISTRY: ActivationBudgetTable = Object.freeze({
  // PUSH
  'bench-press': { chest: 1, front_delts: 0.5, triceps: 0.6, rotator_cuff: 0.15, upper_back: 0.15 },
  'overhead-press': { front_delts: 1, side_delts: 0.45, triceps: 0.6, traps: 0.2, rotator_cuff: 0.25, upper_back: 0.2 },
  'incline-bench-press': { chest: 0.85, front_delts: 0.7, triceps: 0.5, rotator_cuff: 0.15, upper_back: 0.15 },
  'dumbbell-bench-press': { chest: 1, front_delts: 0.5, triceps: 0.55, rotator_cuff: 0.15, upper_back: 0.15 },
  'dumbbell-shoulder-press': { front_delts: 1, side_delts: 0.45, triceps: 0.55, traps: 0.15, rotator_cuff: 0.25, upper_back: 0.2 },
  'lateral-raise': { side_delts: 1, traps: 0.2, rotator_cuff: 0.25 },
  'cable-lateral-raise': { side_delts: 1, traps: 0.15, rotator_cuff: 0.25 },
  'cable-chest-fly': { chest: 1, front_delts: 0.2, upper_back: 0.1 },
  'chest-press-machine': { chest: 1, front_delts: 0.4, triceps: 0.5, rotator_cuff: 0.15, upper_back: 0.15 },
  'tricep-pushdown': { triceps: 1, forearms: 0.15 },
  'overhead-tricep-ext': { triceps: 1 },
  dips: { triceps: 1, chest: 0.7, front_delts: 0.4, rotator_cuff: 0.15, upper_back: 0.15 },
  'machine-pec-fly': { chest: 1, front_delts: 0.2, upper_back: 0.1 },
  'incline-dumbbell-bench-press': { chest: 0.85, front_delts: 0.7, triceps: 0.5, rotator_cuff: 0.15, upper_back: 0.15 },
  'dumbbell-chest-fly': { chest: 1, front_delts: 0.3, upper_back: 0.1, rotator_cuff: 0.15 },
  'decline-bench-press': { chest: 1, front_delts: 0.3, triceps: 0.55, rotator_cuff: 0.15, upper_back: 0.15 },
  'push-ups': { chest: 0.85, front_delts: 0.45, triceps: 0.5, upper_back: 0.15, abs: 0.2 },
  'machine-shoulder-press': { front_delts: 1, side_delts: 0.4, triceps: 0.5, traps: 0.15, rotator_cuff: 0.15, upper_back: 0.15 },
  'machine-lateral-raise': { side_delts: 1, traps: 0.15, rotator_cuff: 0.2 },
  'cable-incline-fly': { chest: 1, front_delts: 0.35, upper_back: 0.1 },
  'skull-crushers': { triceps: 1, forearms: 0.15 },
  'dumbbell-skull-crushers': { triceps: 1, forearms: 0.2 },
  'dumbbell-tricep-kickback': { triceps: 1, rear_delts: 0.2, forearms: 0.15 },
  'cable-rope-overhead-tricep': { triceps: 1, forearms: 0.15, abs: 0.1 },
  'close-grip-bench-press': { triceps: 1, chest: 0.6, front_delts: 0.4, rotator_cuff: 0.15, upper_back: 0.15 },
  'assisted-dip-machine': { triceps: 1, chest: 0.65, front_delts: 0.35, rotator_cuff: 0.15, upper_back: 0.15 },

  // PULL
  'barbell-row': { upper_back: 1, lats: 0.7, rear_delts: 0.5, biceps: 0.5, forearms: 0.3, spinal_erectors: 0.3 },
  'lat-pulldown': { lats: 1, biceps: 0.6, upper_back: 0.35, rear_delts: 0.2, forearms: 0.25 },
  'pull-ups': { lats: 1, biceps: 0.6, upper_back: 0.35, rear_delts: 0.2, forearms: 0.3 },
  'chin-ups': { lats: 0.9, biceps: 0.8, upper_back: 0.3, forearms: 0.3 },
  'seated-cable-row': { upper_back: 1, lats: 0.7, rear_delts: 0.5, biceps: 0.5, forearms: 0.2 },
  'dumbbell-row': { lats: 0.9, upper_back: 0.8, rear_delts: 0.4, biceps: 0.5, forearms: 0.3 },
  'bicep-curl': { biceps: 1, forearms: 0.25 },
  'hammer-curl': { biceps: 0.7, forearms: 0.7 },
  'cable-bicep-curl': { biceps: 1, forearms: 0.2 },
  'face-pull': { rear_delts: 1, upper_back: 0.7, traps: 0.4, biceps: 0.2, rotator_cuff: 0.6 },
  'machine-row': { upper_back: 1, lats: 0.7, rear_delts: 0.45, biceps: 0.5, forearms: 0.25, traps: 0.3 },
  't-bar-row': { upper_back: 1, lats: 0.75, rear_delts: 0.5, biceps: 0.5, forearms: 0.3, spinal_erectors: 0.35, traps: 0.35 },
  'reverse-pec-deck': { rear_delts: 1, upper_back: 0.6, traps: 0.4, rotator_cuff: 0.4 },
  'dumbbell-rear-delt-fly': { rear_delts: 1, upper_back: 0.6, traps: 0.4, rotator_cuff: 0.4, spinal_erectors: 0.2 },
  'straight-arm-pulldown': { lats: 1, upper_back: 0.5, triceps: 0.3, abs: 0.2 },
  'incline-dumbbell-curl': { biceps: 1, forearms: 0.25 },
  'preacher-curl': { biceps: 1, forearms: 0.25 },
  'machine-preacher-curl': { biceps: 1, forearms: 0.2 },
  'cable-hammer-curl': { biceps: 0.7, forearms: 0.7 },
  'dumbbell-shrug': { traps: 1, upper_back: 0.3, forearms: 0.3 },
  'barbell-shrug': { traps: 1, upper_back: 0.3, forearms: 0.35, spinal_erectors: 0.2 },
  'lat-pulldown-machine': { lats: 1, biceps: 0.55, upper_back: 0.35, rear_delts: 0.2, forearms: 0.2 },

  // LEGS
  squat: { quads: 1, glutes: 0.8, adductors: 0.5, spinal_erectors: 0.35, abs: 0.25 },
  deadlift: { glutes: 1, spinal_erectors: 1, hamstrings: 0.8, traps: 0.5, forearms: 0.5, quads: 0.3 },
  'romanian-deadlift': { hamstrings: 1, glutes: 0.8, spinal_erectors: 0.6, forearms: 0.3 },
  'leg-press': { quads: 1, glutes: 0.6, adductors: 0.3, hamstrings: 0.2 },
  'leg-extension': { quads: 1 },
  'leg-curl': { hamstrings: 1, calves: 0.15 },
  'calf-raise': { calves: 1 },
  'bulgarian-split-squat': { quads: 1, glutes: 0.8, adductors: 0.3, hamstrings: 0.25 },
  'dumbbell-rdl': { hamstrings: 1, glutes: 0.8, spinal_erectors: 0.5, forearms: 0.3 },
  'hack-squat': { quads: 1, glutes: 0.7, adductors: 0.4, hamstrings: 0.25 },
  'goblet-squat': { quads: 1, glutes: 0.75, adductors: 0.35, abs: 0.25, spinal_erectors: 0.2 },
  'walking-lunge': { quads: 1, glutes: 0.85, adductors: 0.3, hamstrings: 0.3, calves: 0.2 },
  'seated-leg-curl': { hamstrings: 1, calves: 0.15 },
  'hip-thrust': { glutes: 1, hamstrings: 0.45, adductors: 0.3, quads: 0.2 },
  'machine-hip-thrust': { glutes: 1, hamstrings: 0.4, adductors: 0.25 },
  'standing-calf-raise': { calves: 1 },
  'seated-calf-raise': { calves: 1 },
  'hip-abductor-machine': { glutes: 1 },
  'hip-adductor-machine': { adductors: 1 },

  // CORE
  crunch: { abs: 1 },
  'leg-raise': { hip_flexors: 1, abs: 0.7 },
  'cable-crunch': { abs: 1 },
  'hanging-leg-raise': { hip_flexors: 1, abs: 0.8, forearms: 0.2 },
  'machine-ab-crunch': { abs: 1, obliques: 0.2 },
  'ab-wheel-rollout': { abs: 1, obliques: 0.3, lats: 0.3, upper_back: 0.2 },
  'cable-woodchopper': { obliques: 1, abs: 0.5, front_delts: 0.3 },
  'russian-twist': { obliques: 1, abs: 0.7, hip_flexors: 0.3 },
});

function roleForUnit(
  exerciseId: string,
  unitId: MuscleRecoveryUnitId,
): ActivationRole | null {
  const impact = EXERCISE_IMPACT_BY_ID[exerciseId];
  if (!impact) {
    return null;
  }
  if (impact.primaryUnitIds.includes(unitId)) {
    return 'primary';
  }
  if (impact.secondaryUnitIds.includes(unitId)) {
    return 'secondary';
  }
  if (impact.stabilizerUnitIds.includes(unitId)) {
    return 'stabilizer';
  }
  return null;
}

function resolveQuantitativeProfile(exerciseId: string): ResolvedExerciseProfile {
  const impact = EXERCISE_IMPACT_BY_ID[exerciseId];
  const budgets = ACTIVATION_BUDGET_REGISTRY[exerciseId];
  if (!impact || !budgets) {
    throw new Error(`Cannot resolve unregistered quantitative exercise: ${exerciseId}`);
  }

  const unitCoefficients: Record<string, number> = {};
  for (const [budgetId, rawBudget] of Object.entries(budgets)) {
    const budget = rawBudget ?? 0;
    if (!Number.isFinite(budget) || budget < 0) {
      throw new Error(`Invalid ${exerciseId}/${budgetId} activation budget`);
    }
    if (budget === 0) {
      continue;
    }

    const candidates = RECOVERY_UNITS.flatMap((definition) => {
      if (definition.activationBudgetId !== budgetId) {
        return [];
      }
      const role = roleForUnit(exerciseId, definition.id);
      return role ? [{ unitId: definition.id, weight: ROLE_WEIGHTS[role] }] : [];
    });
    const denominator = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    if (denominator <= 0) {
      throw new Error(`No role-weighted units resolve ${exerciseId}/${budgetId}`);
    }
    for (const candidate of candidates) {
      unitCoefficients[candidate.unitId] =
        (unitCoefficients[candidate.unitId] ?? 0) +
        budget * (candidate.weight / denominator);
    }
  }

  return Object.freeze({
    exerciseId,
    exerciseName: impact.name,
    classification: 'quantitative',
    activationBudgets: Object.freeze({ ...budgets }),
    unitCoefficients: Object.freeze(unitCoefficients),
    primaryUnitIds: Object.freeze([...impact.primaryUnitIds]),
    registryVersion: ACTIVATION_REGISTRY_VERSION,
  });
}

function resolveQualitativeProfile(exerciseId: string): ResolvedExerciseProfile {
  const impact = EXERCISE_IMPACT_BY_ID[exerciseId];
  if (!impact) {
    throw new Error(`Cannot resolve unknown qualitative exercise: ${exerciseId}`);
  }
  return Object.freeze({
    exerciseId,
    exerciseName: impact.name,
    classification: 'qualitative',
    activationBudgets: Object.freeze({}),
    unitCoefficients: Object.freeze({}),
    primaryUnitIds: Object.freeze([...impact.primaryUnitIds]),
    unsupportedReason:
      impact.qualitativeReason ?? 'This exercise has no quantitative V1 activation profile.',
    registryVersion: ACTIVATION_REGISTRY_VERSION,
  });
}

export const RESOLVED_EXERCISE_PROFILES = Object.freeze(
  Object.fromEntries(
    EXERCISE_IMPACT_GUIDE.map((impact) => [
      impact.id,
      impact.qualitativeOnly
        ? resolveQualitativeProfile(impact.id)
        : resolveQuantitativeProfile(impact.id),
    ]),
  ),
) as Readonly<Record<string, ResolvedExerciseProfile>>;

export function getResolvedExerciseProfile(
  exerciseId: string,
): ResolvedExerciseProfile | null {
  return RESOLVED_EXERCISE_PROFILES[exerciseId] ?? null;
}

export function isQuantitativelySupportedExercise(exerciseId: string): boolean {
  return getResolvedExerciseProfile(exerciseId)?.classification === 'quantitative';
}

export function validateActivationRegistry(tolerance = 1e-10): readonly string[] {
  const issues: string[] = [];
  for (const impact of EXERCISE_IMPACT_GUIDE) {
    const profile = RESOLVED_EXERCISE_PROFILES[impact.id];
    if (!profile) {
      issues.push(`missing_profile:${impact.id}`);
      continue;
    }
    for (const unitId of Object.keys(profile.unitCoefficients)) {
      if (!RECOVERY_UNIT_BY_ID[unitId]) {
        issues.push(`unknown_unit:${impact.id}:${unitId}`);
      }
    }
    for (const [budgetId, budget] of Object.entries(profile.activationBudgets)) {
      const resolved = Object.entries(profile.unitCoefficients).reduce(
        (sum, [unitId, coefficient]) =>
          RECOVERY_UNIT_BY_ID[unitId]?.activationBudgetId === budgetId
            ? sum + coefficient
            : sum,
        0,
      );
      if (Math.abs(resolved - (budget ?? 0)) > tolerance) {
        issues.push(`budget_mismatch:${impact.id}:${budgetId}`);
      }
    }
  }
  return Object.freeze(issues);
}
