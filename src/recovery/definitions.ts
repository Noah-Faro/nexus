import type {
  ActivationBudgetId,
  MuscleRecoveryUnitId,
  RecoveryGroupDefinition,
  RecoveryGroupId,
  RecoveryUnitDefinition,
} from './types';
import {
  MUSCLE_RECOVERY_UNIT_IDS,
  RECOVERY_GROUP_IDS,
} from './types';

export const ACTIVATION_BUDGET_IDS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'rotator_cuff',
  'traps',
  'spinal_erectors',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'hip_flexors',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
] as const satisfies readonly ActivationBudgetId[];

const unit = (
  id: MuscleRecoveryUnitId,
  name: string,
  groupId: RecoveryGroupId,
  groupName: string,
  activationBudgetId: ActivationBudgetId,
  view: 'front' | 'back',
  sharedGeometry = false,
  mapSelectable = true,
  mapParent = groupName,
  note?: string,
): RecoveryUnitDefinition => ({
  id,
  name,
  groupId,
  groupName,
  activationBudgetId,
  view,
  aggregationWeight: 1,
  sharedGeometry,
  mapSelectable,
  mapParent,
  note,
});

export const RECOVERY_UNITS = [
  unit('upper_chest', 'Upper chest · clavicular head', 'chest', 'Chest', 'chest', 'front', true),
  unit('lower_chest', 'Mid/lower chest · sternocostal head', 'chest', 'Chest', 'chest', 'front', true),
  unit('anterior_deltoid', 'Anterior deltoid', 'deltoids', 'Deltoids', 'front_delts', 'front', true),
  unit('lateral_deltoid', 'Lateral deltoid', 'deltoids', 'Deltoids', 'side_delts', 'front', true),
  unit('posterior_deltoid', 'Posterior deltoid', 'deltoids', 'Deltoids', 'rear_delts', 'back'),
  unit('biceps_long_head', 'Biceps brachii · long head', 'biceps', 'Biceps', 'biceps', 'front', true),
  unit('biceps_short_head', 'Biceps brachii · short head', 'biceps', 'Biceps', 'biceps', 'front', true),
  unit('brachialis', 'Brachialis', 'biceps', 'Biceps', 'biceps', 'front', true),
  unit('triceps_long_head', 'Triceps long head', 'triceps', 'Triceps', 'triceps', 'back'),
  unit('triceps_lateral_head', 'Triceps lateral head', 'triceps', 'Triceps', 'triceps', 'back'),
  unit('triceps_medial_head', 'Triceps medial head', 'triceps', 'Triceps', 'triceps', 'back'),
  unit('upper_trapezius', 'Upper trapezius', 'trapezius', 'Trapezius', 'traps', 'front'),
  unit('middle_trapezius', 'Middle trapezius', 'trapezius', 'Trapezius', 'traps', 'back', true),
  unit('lower_trapezius', 'Lower trapezius', 'trapezius', 'Trapezius', 'traps', 'back', true),
  unit('latissimus_dorsi', 'Latissimus dorsi', 'upper_back', 'Upper back', 'lats', 'back', true),
  unit('rhomboid', 'Rhomboid', 'upper_back', 'Upper back', 'upper_back', 'back'),
  unit('teres_major', 'Teres major', 'upper_back', 'Upper back', 'upper_back', 'back'),
  unit(
    'serratus_anterior',
    'Serratus anterior',
    'upper_back',
    'Upper back',
    'upper_back',
    'back',
    true,
    true,
    'Upper back',
    'Scapular stabilizer shown in the Upper back product group.',
  ),
  unit('supraspinatus', 'Supraspinatus', 'rotator_cuff', 'Rotator cuff', 'rotator_cuff', 'back', true, true, 'Upper back'),
  unit('infraspinatus', 'Infraspinatus', 'rotator_cuff', 'Rotator cuff', 'rotator_cuff', 'back', true, true, 'Upper back'),
  unit('teres_minor', 'Teres minor', 'rotator_cuff', 'Rotator cuff', 'rotator_cuff', 'back', true, true, 'Upper back'),
  unit('subscapularis', 'Subscapularis', 'rotator_cuff', 'Rotator cuff', 'rotator_cuff', 'front', true, false, 'Upper back'),
  unit('upper_abs', 'Upper abs', 'core', 'Core', 'abs', 'front'),
  unit('lower_abs', 'Lower abs', 'core', 'Core', 'abs', 'front'),
  unit('upper_oblique', 'Upper oblique', 'core', 'Core', 'obliques', 'front'),
  unit('lower_oblique', 'Lower oblique', 'core', 'Core', 'obliques', 'front'),
  unit('rectus_femoris', 'Rectus femoris', 'quadriceps', 'Quadriceps', 'quads', 'front'),
  unit('vastus_lateralis', 'Vastus lateralis', 'quadriceps', 'Quadriceps', 'quads', 'front'),
  unit('vastus_medialis', 'Vastus medialis', 'quadriceps', 'Quadriceps', 'quads', 'front'),
  unit('vastus_intermedius', 'Vastus intermedius', 'quadriceps', 'Quadriceps', 'quads', 'front', true, false),
  unit('biceps_femoris_long_head', 'Biceps femoris · long head', 'hamstrings', 'Hamstrings', 'hamstrings', 'back', true),
  unit('biceps_femoris_short_head', 'Biceps femoris · short head', 'hamstrings', 'Hamstrings', 'hamstrings', 'back', true),
  unit('semitendinosus', 'Semitendinosus', 'hamstrings', 'Hamstrings', 'hamstrings', 'back'),
  unit('semimembranosus', 'Semimembranosus', 'hamstrings', 'Hamstrings', 'hamstrings', 'back'),
  unit('gluteus_maximus', 'Gluteus maximus', 'glutes', 'Glutes', 'glutes', 'back'),
  unit('gluteus_medius', 'Gluteus medius', 'glutes', 'Glutes', 'glutes', 'back'),
  unit('gluteus_minimus', 'Gluteus minimus', 'glutes', 'Glutes', 'glutes', 'back', true),
  unit('adductor_longus', 'Adductor longus', 'adductors', 'Adductors', 'adductors', 'front'),
  unit('adductor_magnus', 'Adductor magnus', 'adductors', 'Adductors', 'adductors', 'front'),
  unit('gracilis', 'Gracilis', 'adductors', 'Adductors', 'adductors', 'front'),
  unit('gastrocnemius_medial_head', 'Gastrocnemius medial head', 'calves', 'Calves', 'calves', 'back'),
  unit('gastrocnemius_lateral_head', 'Gastrocnemius lateral head', 'calves', 'Calves', 'calves', 'back'),
  unit('soleus', 'Soleus', 'calves', 'Calves', 'calves', 'back'),
  unit('tibialis_anterior', 'Tibialis anterior', 'tibialis', 'Tibialis', 'calves', 'front'),
  unit('psoas_major', 'Psoas major', 'hip_flexors', 'Hip flexors', 'hip_flexors', 'front', true, false),
  unit('iliacus', 'Iliacus', 'hip_flexors', 'Hip flexors', 'hip_flexors', 'front', true, false),
  unit('brachioradialis', 'Brachioradialis', 'forearms', 'Forearms', 'forearms', 'front'),
  unit('forearm_flexors', 'Forearm flexors', 'forearms', 'Forearms', 'forearms', 'front'),
  unit('forearm_extensors', 'Forearm extensors', 'forearms', 'Forearms', 'forearms', 'back'),
  unit('upper_erector_spinae', 'Upper erector spinae', 'spinal_erectors', 'Erector spinae', 'spinal_erectors', 'back'),
  unit('lower_erector_spinae', 'Lower erector spinae', 'spinal_erectors', 'Erector spinae', 'spinal_erectors', 'back'),
] as const satisfies readonly RecoveryUnitDefinition[];

const group = (id: RecoveryGroupId, name: string): RecoveryGroupDefinition => ({
  id,
  name,
  unitIds: RECOVERY_UNITS.filter((candidate) => candidate.groupId === id).map(
    (candidate) => candidate.id,
  ),
  groupScale: 6,
});

export const RECOVERY_GROUPS = [
  group('chest', 'Chest'),
  group('deltoids', 'Deltoids'),
  group('biceps', 'Biceps'),
  group('triceps', 'Triceps'),
  group('trapezius', 'Trapezius'),
  group('upper_back', 'Upper back'),
  group('rotator_cuff', 'Rotator cuff'),
  group('core', 'Core'),
  group('quadriceps', 'Quadriceps'),
  group('hamstrings', 'Hamstrings'),
  group('glutes', 'Glutes'),
  group('adductors', 'Adductors'),
  group('calves', 'Calves'),
  group('tibialis', 'Tibialis'),
  group('hip_flexors', 'Hip flexors'),
  group('forearms', 'Forearms'),
  group('spinal_erectors', 'Erector spinae'),
] as const satisfies readonly RecoveryGroupDefinition[];

if (
  RECOVERY_UNITS.length !== MUSCLE_RECOVERY_UNIT_IDS.length ||
  RECOVERY_UNITS.some(
    (definition, index) => definition.id !== MUSCLE_RECOVERY_UNIT_IDS[index],
  )
) {
  throw new Error('Recovery unit definitions must match the canonical ID registry.');
}

if (
  RECOVERY_GROUPS.length !== RECOVERY_GROUP_IDS.length ||
  RECOVERY_GROUPS.some(
    (definition, index) => definition.id !== RECOVERY_GROUP_IDS[index],
  )
) {
  throw new Error('Recovery group definitions must match the canonical ID registry.');
}

export const RECOVERY_UNIT_BY_ID = Object.freeze(
  Object.fromEntries(RECOVERY_UNITS.map((definition) => [definition.id, definition])),
) as Readonly<Record<string, RecoveryUnitDefinition>>;

export const RECOVERY_GROUP_BY_ID = Object.freeze(
  Object.fromEntries(RECOVERY_GROUPS.map((definition) => [definition.id, definition])),
) as Readonly<Record<string, RecoveryGroupDefinition>>;

export function getUnitScale(unitId: string): number {
  const definition = RECOVERY_UNIT_BY_ID[unitId];
  if (!definition) {
    throw new Error(`Unknown recovery unit: ${unitId}`);
  }
  const groupDefinition = RECOVERY_GROUP_BY_ID[definition.groupId];
  const totalWeight = groupDefinition.unitIds.reduce(
    (sum, childId) => sum + RECOVERY_UNIT_BY_ID[childId].aggregationWeight,
    0,
  );
  return groupDefinition.groupScale * (definition.aggregationWeight / totalWeight);
}
